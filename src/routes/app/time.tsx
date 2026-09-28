import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/time")({
  component: () => <ModulePlaceholder titleKey="app.time" />,
});
