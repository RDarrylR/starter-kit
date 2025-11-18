import { resizeImage } from '@starter-kit/utils/image';
import { User } from '../generated/graphql';
import { Avatar } from './avatar';
import { CoverImage } from './cover-image';
import { DateFormatter } from './date-formatter';
import { ReadTimeInMinutes } from './post-read-time-in-minutes';
import { PostTitle } from './post-title';

type Author = Pick<User, 'username' | 'name' | 'profilePicture'>;

type Props = {
	title: string;
	coverImage: string | null | undefined;
	date: string;
	author: Author;
	readTimeInMinutes: number;
};

export const PostHeader = ({ title, coverImage, date, author, readTimeInMinutes }: Props) => {
  console.log('PostHeader props:', { title, coverImage, date, author, readTimeInMinutes });
	return (
		<>
			<PostTitle>{title}</PostTitle>
			<div className="flex flex-row flex-wrap items-center justify-center w-full gap-2 px-2 text-slate-700 dark:text-neutral-300 md:px-0">
				<Avatar
					username={author.username}
					name={author.name}
					size={10}
					picture={"https://kagi.com/proxy/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f4239364c6844346630344d6867413d3d2d3635393730363731382e313661363966333030633064383634333939313435373933353137312e6a7067?c=1JAkVVrnOTa6XJatr6D8xHzY21KE_NnG5s38sySa5XdBxNrgewUI6KjQgY3MhVTnSYW9y1rMUbsvpfzMJaDXCGvxm7fbPMxScisZfSPQiQre4tr6A9bXdqztXAnEdtmNSPWAUvnSmaOvXdvgnwudbG4SR-2jdRXMDVZM5aHLNPLAb4mJyyRbHbbSyu9rh4HBnFi2hI_BSSxlyfA85-rxzh-eapRToM1LWE8CnqPX8C6EETeSqIumZwRF-AFGewf9WVMgOgMjdVBHcjsN0DbHKdMwDXQSbGjPL8SZKtppZ7V9W8RVCwvcyuNVr0wtxt_x4CmsDOwnAQlJwK1L1V0VQnGlg3w27AcsKFh7JYlO8VGX3mWmxbxiQPpnUyHzZxnMB9aemEqpPOjT8sfHDUudWzqAFkVQE9mlQCZmfvDA2bE%3D"}
				/>
				<span className="block font-bold text-slate-500">&middot;</span>
				<DateFormatter dateString={date} />
				{readTimeInMinutes && <span className="block font-bold text-slate-500">&middot;</span>}
				<ReadTimeInMinutes readTimeInMinutes={readTimeInMinutes} />
			</div>
			{coverImage && (
				<div className="w-full px-5 sm:mx-0">
					<CoverImage
            title="ABC"
						src={resizeImage(coverImage, { w: 1600, h: 840, c: 'thumb' })}
						priority={true}
					/>
				</div>
			)}
		</>
	);
};
