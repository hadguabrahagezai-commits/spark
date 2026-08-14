import { Page, PageHeader } from "../components/Layout";

export default function Privacy() {
  return (
    <Page>
      <PageHeader title="Datenschutz" subtitle="Wie wir deine Daten schützen" />
      <div className="prose max-w-none dark:prose-invert">
        <h2>Datenschutz</h2>
        <p>Diese App respektiert deine Privatsphäre. Persönliche Daten werden nur mit deiner Zustimmung verarbeitet.</p>
        <h3>Welche Daten wir sammeln</h3>
        <ul>
          <li>Account-Informationen (E-Mail, Name)</li>
          <li>Optionale Companion/Avatar-Konfigurationen</li>
          <li>Diagnose- und Nutzungsdaten zur Verbesserung des Dienstes</li>
        </ul>
        <h3>Kontakt</h3>
        <p>Bei Fragen schreibe an <a href="mailto:privacy@example.com">privacy@example.com</a>.</p>
      </div>
    </Page>
  );
}
