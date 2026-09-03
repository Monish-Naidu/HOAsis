import { ForumBoard } from "@/components/app/forum-board";

export const metadata = {
  title: "Community",
  description: "What your neighbors are posting.",
};

export default function AdminCommunity() {
  return <ForumBoard moderate />;
}
