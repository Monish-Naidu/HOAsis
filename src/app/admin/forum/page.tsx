import { ForumBoard } from "@/components/app/forum-board";

export const metadata = { title: "Forum" };

export default function AdminForum() {
  return <ForumBoard moderate />;
}
