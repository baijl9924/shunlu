import {
  Accessibility,
  ArrowUpDown,
  Bath,
  Bike,
  Construction,
  Footprints,
  MapPin,
  SquareParking,
  TrendingUp,
  type LucideProps,
} from 'lucide-react';

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  盲道被占用: Bike,
  盲道断头或损坏: Construction,
  缺少坡道或坡道损坏: Accessibility,
  坡道过陡: TrendingUp,
  台阶没有扶手: Footprints,
  无障碍电梯故障: ArrowUpDown,
  无障碍卫生间问题: Bath,
  无障碍停车位被占: SquareParking,
  其他: MapPin,
};

export default function CategoryIcon({ category, className = 'h-4 w-4' }: { category: string; className?: string }) {
  const Icon = MAP[category] || MapPin;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}
