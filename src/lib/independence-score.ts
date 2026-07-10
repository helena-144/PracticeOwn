export interface ScoreLabelInfo {
  label: string;
  description: string;
  tone: "destructive" | "warning" | "default" | "success";
}

/**
 * 0-25: At Risk / 26-50: Platform Dependent / 51-75: Building Independence / 76-100: Practice Owner
 */
export function getScoreLabel(score: number): ScoreLabelInfo {
  if (score <= 25) {
    return {
      label: "At Risk",
      description: "Your practice is heavily dependent on outside platforms and payers.",
      tone: "destructive",
    };
  }
  if (score <= 50) {
    return {
      label: "Platform Dependent",
      description: "You rely significantly on credentialing platforms rather than your own contracts.",
      tone: "warning",
    };
  }
  if (score <= 75) {
    return {
      label: "Building Independence",
      description: "You're making real progress toward owning your practice's credentialing.",
      tone: "default",
    };
  }
  return {
    label: "Practice Owner",
    description: "Your practice operates largely independently of outside platforms.",
    tone: "success",
  };
}
