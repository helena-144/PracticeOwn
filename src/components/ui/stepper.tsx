import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepperStep {
  id: number;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}

/**
 * Custom stepper (shadcn/ui has no built-in stepper primitive). Full
 * labeled row of circles + connectors on md+ screens; collapses to a
 * "Step X of N" label on small screens, since horizontal labels don't fit.
 */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  const activeStep = steps.find((step) => step.id === currentStep);

  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-muted-foreground md:hidden">
        Step {currentStep} of {steps.length}
        {activeStep ? `: ${activeStep.label}` : null}
      </p>
      <ol className="hidden items-center md:flex">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className={cn("flex items-center", index !== steps.length - 1 && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index !== steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
