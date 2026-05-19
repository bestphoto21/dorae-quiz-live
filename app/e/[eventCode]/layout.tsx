import type { ReactNode } from "react";
import { AudienceLayout } from "@/components/quiz/ui";

type EventLayoutProps = {
  children: ReactNode;
  params: Promise<{ eventCode: string }>;
};

export default async function EventLayout({
  children,
  params,
}: EventLayoutProps) {
  const { eventCode } = await params;

  return <AudienceLayout eventCode={eventCode}>{children}</AudienceLayout>;
}
