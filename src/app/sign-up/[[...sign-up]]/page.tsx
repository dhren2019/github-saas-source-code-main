import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-6 px-6">
      <div className="w-full max-w-[1200px] h-[min(88vh,900px)] rounded-[12px] overflow-hidden shadow-lg grid lg:grid-cols-2 gap-0">

        {/* Left - white panel with Clerk SignUp */}
        <div className="bg-white flex flex-col p-6 sm:p-8">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-0 bg-transparent",
                    headerTitle: "text-2xl font-semibold text-slate-900",
                    headerSubtitle: "text-slate-600",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white rounded-md py-2 px-4",
                    formFieldInput: "border border-slate-200 rounded-md px-3 py-2",
                    dividerText: "text-slate-400",
                    socialButtonsBlockButton: "border border-slate-200 rounded-md",
                    footer: "hidden"
                  }
                }}
              />
            </div>
          </div>

          <div className="text-sm text-slate-500 text-center pt-6">© 2025 Dhren Studio</div>
        </div>

        {/* Right - large illustration as background, occupies entire right half */}
        <div className="hidden lg:block bg-[url('/signup.svg')] bg-cover bg-center" aria-hidden="true" />

      </div>
    </div>
  )
}