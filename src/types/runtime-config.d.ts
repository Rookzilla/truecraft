export {}

declare global {
  interface Window {
    __TRUECRAFT_CONFIG__?: {
      cognitoAuthUrl?: string
      cognitoClientId?: string
    }
  }
}
