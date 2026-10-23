import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import EmpForm from "@/components/EmpForm";
import { Flash, Head } from "@/components/ui";

export default async function NewEmployee({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePerm("employees");
  const sp = await searchParams;
  const { org } = await getSettings();
  const opts = { desig: await activeList("desig"), dept: await activeList("dept"), cat: await activeList("cat"), shift: await activeList("shift") };
  const codes = await activeList("cat", 1);
  return (
    <>
      <Head title="Add employee" sub={`Employee IDs start with the category code (${codes.join(", ")}), then a dash and a number.`}><a className="btn sm" href="/employees">Back to list</a></Head>
      <Flash sp={sp} />
      <EmpForm e={{ status: "Probation", name: sp.name }} opts={opts} isNew prefix={org.prefix} />
    </>
  );
}
