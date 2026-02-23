# Blog Homepage Investigation: New Article Not Displaying

## Issue Description
The main page at https://darryl-ruggles.cloud/ does not show the new article "serverless-recipe-assistant-with-agentcore-and-strands" while the direct link to the article works correctly.

## Investigation Summary

### Files Analyzed
1. `packages/blog-starter-kit/themes/enterprise/pages/index.tsx` - Homepage component and data fetching
2. `packages/blog-starter-kit/themes/enterprise/lib/api/queries/PostsByPublication.graphql` - GraphQL query for posts
3. `packages/blog-starter-kit/themes/enterprise/pages/[slug].tsx` - Individual post page
4. `packages/blog-starter-kit/themes/enterprise/generated/schema.graphql` - GraphQL schema definitions
5. `packages/blog-starter-kit/themes/enterprise/next.config.js` - Next.js configuration

---

## Root Cause Analysis

### 1. ISR (Incremental Static Regeneration) Configuration

**Current Configuration:**
```typescript
// pages/index.tsx (line 204)
return {
  props: { ... },
  revalidate: 1, // Regenerate page at most once per second
};
```

**Issues with `revalidate: 1`:**
- This extremely aggressive value (1 second) can cause issues with CDN caching behavior
- Vercel's ISR uses a "stale-while-revalidate" approach:
  1. First request after the revalidation period returns the stale (cached) page
  2. A background regeneration is triggered
  3. Subsequent requests get the new page once regeneration completes
- With `revalidate: 1`, rapid requests might not trigger proper regeneration
- Edge caching and CDN propagation delays can exceed this window

### 2. GraphQL Query - No Explicit Sorting

**Current Query (`PostsByPublication.graphql`):**
```graphql
query PostsByPublication($host: String!, $first: Int!, $after: String) {
  publication(host: $host) {
    ...Publication
    posts(first: $first, after: $after) {
      totalDocuments
      edges {
        node {
          ...Post
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
}
```

**Problem:** The query does not specify a sorting order. While the Hashnode API likely returns posts sorted by `publishedAt` descending by default, there's no explicit guarantee. Any API-side changes could affect the order.

### 3. Static Path Generation

**`[slug].tsx` getStaticPaths:**
```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const data = await request<SlugPostsByPublicationQuery, SlugPostsByPublicationQueryVariables>(
    process.env.NEXT_PUBLIC_HASHNODE_GQL_ENDPOINT,
    SlugPostsByPublicationDocument,
    {
      first: 10, // Only pre-generates 10 post pages
      host: process.env.NEXT_PUBLIC_HASHNODE_PUBLICATION_HOST,
    },
  );
  // ...
  return {
    paths: postSlugs.map((slug) => ({ params: { slug } })),
    fallback: 'blocking', // Allows new posts to be generated on-demand
  };
};
```

**This is correct:** The `fallback: 'blocking'` setting allows new posts to be server-rendered on first request, which is why the direct link works. However, the homepage must be revalidated to include the new post in its list.

---

## Why Direct Link Works but Homepage Doesn't

| Aspect | Homepage (`/`) | Direct Link (`/[slug]`) |
|--------|---------------|-------------------------|
| Data Fetch | Fetches list of first 10 posts | Fetches single post by slug |
| Static Generation | Pre-generated at build time | `fallback: 'blocking'` - generated on first request |
| Shows New Post | Depends on ISR revalidation | Always works (queries specific post by slug) |
| Cache Duration | `revalidate: 1` (but CDN may cache longer) | `revalidate: 1` |

The direct link fetches the specific post by its slug from the API (`SinglePostByPublication` query), so it always returns the correct data. The homepage fetches a list and relies on ISR to update, which may be cached at the CDN level.

---

## Potential Fixes

### Fix 1: Increase Revalidation Period (Recommended - Simple)

**File:** `packages/blog-starter-kit/themes/enterprise/pages/index.tsx`

```typescript
// Change line 204 from:
revalidate: 1,

// To a more reasonable value:
revalidate: 60, // Regenerate at most once per minute
```

**Rationale:** A 1-second revalidation period is too aggressive and may interfere with proper CDN behavior. A 60-second period provides a better balance between freshness and reliability.

### Fix 2: Implement On-Demand Revalidation (Recommended - Best Practice)

Create a new API route for on-demand ISR:

**New File:** `packages/blog-starter-kit/themes/enterprise/pages/api/revalidate.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check for secret to protect the endpoint
  if (req.query.secret !== process.env.REVALIDATION_SECRET) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    // Revalidate the homepage
    await res.revalidate('/');
    
    // Optionally revalidate a specific post page
    const slug = req.query.slug as string;
    if (slug) {
      await res.revalidate(`/${slug}`);
    }
    
    return res.json({ revalidated: true });
  } catch (err) {
    return res.status(500).send('Error revalidating');
  }
}
```

**Usage:** Configure a webhook from Hashnode to call this endpoint when a post is published/updated.

### Fix 3: Add Cache-Control Headers via Vercel Configuration

**File:** `packages/blog-starter-kit/themes/enterprise/vercel.json`

```json
{
  "framework": "nextjs",
  "headers": [
    {
      "source": "/",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate=120"
        }
      ]
    }
  ]
}
```

### Fix 4: Force Manual Revalidation (Immediate - Workaround)

If you need the new post to appear immediately, you can:

1. **Trigger a Vercel Redeploy** - This will regenerate all static pages
2. **Use Vercel's ISR Override** - In the Vercel dashboard, navigate to the deployment and use the "Revalidate" feature for the homepage

---

## Recommended Action Plan

### Immediate Fix
1. Trigger a redeploy of the site to regenerate the homepage

### Short-term Fix
2. Update `revalidate: 1` to `revalidate: 60` in both:
   - `pages/index.tsx` (line 204)
   - `pages/[slug].tsx` (lines 231 and 241)

### Long-term Fix
3. Implement on-demand revalidation API endpoint
4. Configure Hashnode webhook to call the revalidation endpoint when posts are published

---

## Additional Notes

### Why `revalidate: 1` is Problematic

1. **Vercel's ISR behavior:** The first request after the revalidation period serves stale content while triggering background regeneration. With `revalidate: 1`, this creates a race condition where the stale content may be served repeatedly.

2. **CDN Edge Caching:** Vercel's edge network may have its own caching that doesn't respect such short revalidation periods.

3. **API Rate Limiting:** Very short revalidation periods could potentially trigger rate limits on the Hashnode GraphQL API.

### The GraphQL Query is Not Filtering Out Posts

After reviewing `PostsByPublication.graphql`, the query does not apply any filters that would exclude posts. The `PublicationPostConnectionFilter` input type supports:
- `excludePinnedPost: Boolean`
- `tagSlugs: [String!]`
- `tags: [ObjectId!]`

None of these are being used, so all posts should be returned.

### Conclusion

The most likely cause is **ISR caching behavior** combined with the very aggressive `revalidate: 1` setting. The CDN may be serving cached content longer than expected, and the short revalidation period may be interfering with proper background regeneration.

---

## Files Modified by This Investigation

None - this is a documentation-only investigation. Changes should be applied based on the recommendations above.
