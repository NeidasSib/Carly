import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type VehicleCardProps = {
  name: string;
  model: string;
  year: number;
  image: string;
  licensePlate: string;
};
// FIX THE IMAGE LATERE
export default function VehicleCard({
  name,
  model,
  year,
  image,
  licensePlate,
}: VehicleCardProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0 max-h-105">
      <div className="relative w-full max-h-52 h-52 overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{name}</CardTitle>
        <CardDescription>
          Model: {model}, Year: {year}
        </CardDescription>
        <CardAction></CardAction>
      </CardHeader>
      <CardContent className="">
        <p> {licensePlate} </p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" size="icon" className="rounded-full">
          <PlusIcon />
        </Button>
        <Link href={"/vehicles/${vehicle.id}"}>
          <Button variant="outline" className="rounded-full ">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
