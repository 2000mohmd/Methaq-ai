import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/calendar")({
  component: () => <ModulePlaceholder titleKey="app.calendar" />,
});
