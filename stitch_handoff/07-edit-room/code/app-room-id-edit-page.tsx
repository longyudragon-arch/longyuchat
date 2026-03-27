import { EditRoomPage } from "@/components/edit-room-page";

interface EditRoomRoutePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRoomRoutePage({ params }: EditRoomRoutePageProps) {
  const { id } = await params;
  return <EditRoomPage roomId={id} />;
}
