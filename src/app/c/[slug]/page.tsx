import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuildView } from "@/components/build/build-view";
import { CoursePlayer } from "@/components/player/course-player";
import { getCourseRecord } from "@/lib/courses";

export async function generateMetadata(props: PageProps<"/c/[slug]">): Promise<Metadata> {
  const record = await getCourseRecord((await props.params).slug);
  return { title: record ? `${record.input.topic} · Shifu` : "Shifu" };
}

async function Course({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const { slug } = await params;
  const record = await getCourseRecord(slug);
  if (!record) notFound();

  const { course, progress } = record;
  if (!course || course.timeline.length === 0) {
    return <BuildView slug={slug} topic={record.input.topic} progress={progress} plan={course?.plan ?? null} />;
  }
  const building = progress.step !== "ready" && progress.step !== "failed";
  return <CoursePlayer course={course} build={building ? progress : undefined} />;
}

export default function CoursePage(props: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<main className="intro">Loading the course…</main>}>
      <Course params={props.params} />
    </Suspense>
  );
}
