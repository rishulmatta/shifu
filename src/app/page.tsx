import Link from "next/link";
import { Mark } from "@/components/mark";

export default function Home() {
  return (
    <main className="intro">
      <Mark size={112} />
      <h1>Shifu</h1>
      <p>Any topic, taught by the best moments on YouTube, and checked until it sticks.</p>
      <Link className="cta" href="/c/bayes-sample">
        Try the sample course: Bayes&apos; theorem
      </Link>
      <p className="note">Being built in public during the Meta Global AI Developer Hackathon, 27 Oct – 4 Nov 2026.</p>
    </main>
  );
}
