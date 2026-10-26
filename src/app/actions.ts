"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { buildCourse, cached, newRecord } from "@/lib/pipeline/build";
import { liveSources, missingForBuilds } from "@/lib/sources";
import { getStore } from "@/lib/store";

const Input = z.object({
  topic: z.string().trim().min(3, "Tell Shifu what you want to learn.").max(120, "Keep the topic under 120 characters."),
  goal: z.string().trim().max(200, "Keep the goal under 200 characters."),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  minutesPerDay: z.coerce.number().int().min(5).max(60),
});

export interface CreateState {
  error?: string;
  values?: Record<string, string>;
}

const slugFor = (topic: string) =>
  `${topic
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`;

export async function createCourse(_: CreateState, form: FormData): Promise<CreateState> {
  const values = Object.fromEntries(["topic", "goal", "level", "minutesPerDay"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = Input.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values };

  const missing = missingForBuilds();
  if (missing.length) return { error: `Course building isn't switched on yet: Shifu still needs ${missing.join(", ")}.`, values };

  const input = { ...parsed.data, goal: parsed.data.goal || `Understand ${parsed.data.topic}` };
  const slug = slugFor(input.topic);
  const store = getStore();
  await store.createCourse(newRecord(slug, input));
  after(() => buildCourse(slug, input, cached(liveSources, store), store));
  redirect(`/c/${slug}`);
}
