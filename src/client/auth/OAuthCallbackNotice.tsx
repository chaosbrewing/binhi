import { useLocation } from "react-router-dom";

const messages: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again or use your password.",
  invalid_response: "The sign-in response could not be verified. Please try again.",
  invalid_token: "The sign-in response could not be verified. Please try again.",
  invalid_state: "Your sign-in session expired. Please try again.",
  provider_unavailable: "That sign-in option is temporarily unavailable.",
  account_exists: "An account already exists for that email. Sign in with your existing method.",
  signup_disabled: "New accounts are currently unavailable.",
  identity_conflict: "That sign-in identity is already connected to another account.",
  email_required: "The provider did not return an email address. Try another sign-in method.",
  reauth_required: "Please verify your identity again before continuing.",
};

export function OAuthCallbackNotice() {
  const location = useLocation();
  const key = new URLSearchParams(location.search).get("oauth_error");
  const message = key ? messages[key] : undefined;
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}
