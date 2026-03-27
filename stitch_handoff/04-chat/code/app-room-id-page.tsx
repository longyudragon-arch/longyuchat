import { RoomChatPage } from "@/components/room-chat-page";

interface RoomDetailRoutePageProps {
  params: Promise<{ id: string }>;
}

export default async function RoomDetailRoutePage({ params }: RoomDetailRoutePageProps) {
  const { id } = await params;
  return <RoomChatPage roomId={id} />;
}
