import { SignIn } from "@clerk/nextjs"
 
export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
            footerActionLink: 'text-blue-600 hover:text-blue-700',
          },
        }}
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </div>
  )
}
