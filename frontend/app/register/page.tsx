import { RegisterForm } from "@/features/auth/RegisterForm";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-muted">
          Join EUKOV and tell us what you like to read.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
