import BuildingClient from '@/components/building/BuildingClient';

export default function BatimentPage({ params }: { params: { id: string } }) {
  return <BuildingClient buildingId={params.id} />;
}
