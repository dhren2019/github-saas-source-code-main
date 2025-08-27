import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-6 px-6">
      <div className="w-full max-w-[1200px] h-[min(88vh,900px)] rounded-[12px] overflow-hidden shadow-lg grid lg:grid-cols-2 gap-0">

        {/* Left - ilustración como background ocupando toda la mitad izquierda sin padding y anclada al fondo */}
        <div className="hidden lg:block h-full bg-[url('/robot.svg')] bg-cover bg-bottom bg-no-repeat m-0 p-0 rounded-none" aria-hidden="true" />

        {/* Right - panel blanco con SignIn */}
        <div className="bg-white flex flex-col p-6 sm:p-8">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-0 bg-transparent",
                    headerTitle: "text-2xl font-semibold text-slate-900",
                    headerSubtitle: "text-slate-600",
                    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 px-4",
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

      </div>
    </div>
  )
}