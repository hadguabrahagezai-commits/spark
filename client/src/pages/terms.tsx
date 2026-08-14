import { Page, PageHeader } from "../components/Layout";

export default function Terms() {
  return (
    <Page>
      <PageHeader title="Nutzungsbedingungen" subtitle="Regeln für die Nutzung des Dienstes" />
      <div className="prose max-w-none dark:prose-invert">
        <h2>Nutzungsbedingungen</h2>
        <p>Bitte lies diese Bedingungen sorgfältig. Durch Nutzung der App erklärst du dich mit ihnen einverstanden.</p>
        <h3>Haftung</h3>
        <p>Die App wird ohne Gewährleistung bereitgestellt. Wir haften nicht für indirekte Schäden.</p>
        <h3>Änderungen</h3>
        <p>Wir können diese Bedingungen anpassen; wichtige Änderungen werden wir ankündigen.</p>
      </div>
    </Page>
  );
}
