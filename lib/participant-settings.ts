export type ParticipantFeatureSettings = {
  participant_title: string | null;
  participant_description: string | null;
  participant_show_quiz: boolean | null;
  participant_show_qna: boolean | null;
  participant_show_survey: boolean | null;
  participant_show_draw: boolean | null;
};

export type ResolvedParticipantFeatureSettings = {
  participant_title: string | null;
  participant_description: string | null;
  participant_show_quiz: boolean;
  participant_show_qna: boolean;
  participant_show_survey: boolean;
  participant_show_draw: boolean;
};

export const PARTICIPANT_SETTINGS_SELECT = `
  participant_title,
  participant_description,
  participant_show_quiz,
  participant_show_qna,
  participant_show_survey,
  participant_show_draw
`;

export const DEFAULT_PARTICIPANT_FEATURE_SETTINGS: ResolvedParticipantFeatureSettings = {
  participant_title: null,
  participant_description: null,
  participant_show_quiz: true,
  participant_show_qna: true,
  participant_show_survey: true,
  participant_show_draw: true,
};

export function resolveParticipantFeatureSettings(
  settings: Partial<ParticipantFeatureSettings> | null | undefined
): ResolvedParticipantFeatureSettings {
  return {
    participant_title: settings?.participant_title?.trim() || null,
    participant_description: settings?.participant_description?.trim() || null,
    participant_show_quiz: settings?.participant_show_quiz ?? true,
    participant_show_qna: settings?.participant_show_qna ?? true,
    participant_show_survey: settings?.participant_show_survey ?? true,
    participant_show_draw: settings?.participant_show_draw ?? true,
  };
}

export function participantFeatureFlagsEnabled(
  settings: ResolvedParticipantFeatureSettings
) {
  return (
    settings.participant_show_quiz ||
    settings.participant_show_qna ||
    settings.participant_show_survey ||
    settings.participant_show_draw
  );
}

export function getParticipantScreenTitle(
  event: { title: string } & Partial<ParticipantFeatureSettings>
) {
  return event.participant_title?.trim() || event.title;
}

export function getParticipantScreenDescription(
  event: { subtitle?: string | null } & Partial<ParticipantFeatureSettings>,
  fallback: string
) {
  return event.participant_description?.trim() || event.subtitle?.trim() || fallback;
}
