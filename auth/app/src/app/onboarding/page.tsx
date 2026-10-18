import OnboardingElement from "@/components/auth/onboarding-element";
import { config } from "@/lib/config";

export default function OnboardingPage() {
  return <OnboardingElement authUrl={config.authUrl} />;
}
