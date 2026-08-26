import { FillForm } from "./fill-form";
import { architecturalForms } from "@/lib/data";

/** Prerenders the baseline forms so a resident opening one gets it instantly. */
export function generateStaticParams() {
  return architecturalForms.map((form) => ({ formId: form.id }));
}

export default async function FormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  return (
    <div className="animate-rise">
      <FillForm formId={formId} />
    </div>
  );
}
