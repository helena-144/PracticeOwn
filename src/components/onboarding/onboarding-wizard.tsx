"use client";

import { useCallback, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { createClient } from "@/lib/supabase/client";

import { Step1Practice } from "./step-1-practice";
import { Step2NpiCaqh } from "./step-2-npi-caqh";
import { Step3Credentials } from "./step-3-credentials";
import { Step4Payers } from "./step-4-payers";
import { Step5ScoreReveal } from "./step-5-score-reveal";
import type { WizardData } from "./wizard-types";

const STEPS: StepperStep[] = [
  { id: 1, label: "Practice" },
  { id: 2, label: "NPI & CAQH" },
  { id: 3, label: "Credentials" },
  { id: 4, label: "Payers" },
  { id: 5, label: "Your Score" },
];

export function OnboardingWizard({ initialData }: { initialData: WizardData }) {
  const [data, setData] = useState(initialData);
  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(initialData.practice.onboarding_step, 1), 5)
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();

    const [{ data: practice }, { data: clinician }, { data: credentials }, { data: payerEnrollments }] =
      await Promise.all([
        supabase.from("practices").select("*").eq("id", initialData.practice.id).single(),
        supabase.from("clinicians").select("*").eq("id", initialData.clinician.id).single(),
        supabase.from("credentials").select("*").eq("clinician_id", initialData.clinician.id),
        supabase.from("payer_enrollments").select("*").eq("clinician_id", initialData.clinician.id),
      ]);

    if (practice && clinician) {
      setData({
        practice,
        clinician,
        credentials: credentials ?? [],
        payerEnrollments: payerEnrollments ?? [],
      });
    }
  }, [initialData.practice.id, initialData.clinician.id]);

  const goNext = useCallback(() => {
    setCurrentStep((step) => Math.min(step + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((step) => Math.max(step - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const stepProps = { data, refresh, onNext: goNext, onBack: goBack };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Stepper steps={STEPS} currentStep={currentStep} />
        <Progress value={(currentStep / STEPS.length) * 100} />
      </div>

      {currentStep === 1 && <Step1Practice {...stepProps} />}
      {currentStep === 2 && <Step2NpiCaqh {...stepProps} />}
      {currentStep === 3 && <Step3Credentials {...stepProps} />}
      {currentStep === 4 && <Step4Payers {...stepProps} />}
      {currentStep === 5 && <Step5ScoreReveal {...stepProps} />}
    </div>
  );
}
