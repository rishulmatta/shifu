import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoursePlayer } from "@/components/player/course-player";
import { getCourse } from "@/lib/courses";

export async function generateMetadata(props: PageProps<"/c/[slug]">): Promise<Metadata> {
  const course = await getCourse((await props.params).slug);
  return { title: course ? `${course.plan.topic} · Shifu` : "Shifu" };
}

async function Course({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const course = await getCourse((await params).slug);
  if (!course) notFound();
  return <CoursePlayer course={course} />;
}

export default function CoursePage(props: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<main className="intro">Loading the course…</main>}>
      <Course params={props.params} />
    </Suspense>
  );
}
