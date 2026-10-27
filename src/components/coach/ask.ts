// How the lesson's coach controls reach the coach window: a browser event, so a control under a
// question doesn't need the window's state passed down to it.

export interface CoachRequest {
  /** What the learner's message reads as in the window. */
  text: string;
  /** Sent with the message when a control names its objective (see the coach route). */
  intent?: { kind: "practice" | "basics"; objectiveId: string };
  /** Done in the browser without asking the server. */
  local?: "skip";
}

export const COACH_EVENT = "shifu:coach";
export const MAP_EVENT = "shifu:map";

export const askCoach = (request: CoachRequest) => window.dispatchEvent(new CustomEvent<CoachRequest>(COACH_EVENT, { detail: request }));

/** Opens the full mind map with one concept picked out. */
export const showOnMap = (conceptId: string) => window.dispatchEvent(new CustomEvent<string>(MAP_EVENT, { detail: conceptId }));
