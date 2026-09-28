import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/app/emails")({
  component: () => <ModulePlaceholder titleKey="app.emails" />,
});
