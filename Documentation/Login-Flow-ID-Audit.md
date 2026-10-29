# Login flow และแผน ID — 7-Eleven iOS

ตรวจวันที่ 2026-10-29 จาก branch develop/12.56.0, HEAD e81a94a102 และ working tree ปัจจุบัน
มีงานเดิมค้างใน Podfile.lock และ project.pbxproj; การตรวจนี้ไม่แก้ไฟล์แอปหรือ IDFile
สถานะ: static source audit และ ID proposal ไม่ใช่ผลทดสอบบน Simulator ไม่ยืนยัน Android/Web ใช้ UI เดียวกัน

## จุดเข้าและ flow ที่พบ

1. Authentication.swift เรียก AuthenScene.newlanding หลาย entry points → LoginLandingViewController ซึ่งตรงกับองค์ประกอบในภาพที่ผู้ใช้ส่งมา
2. LoginLandingViewModel เรียก getLatestLoginProvider ตอนเปิดหน้า ถ้าได้ข้อมูลไม่ว่างจะ push LatestLoginLanding อัตโนมัติ จึงต้องรองรับทั้ง landing ปกติและ latest login
3. Phone: กรอกเบอร์ → PhoneOTPViewModel / PhoneSignInOTPViewController → generate/verify OTP → preVerify
   - เบอร์เดิม + อุปกรณ์เดิม: สร้าง custom token และเข้าสู่ขั้นตอนหลัง login
   - เบอร์เดิม + อุปกรณ์ใหม่ + เป็น All Member: ไป VerifyAllmember
   - อุปกรณ์ใหม่ + ไม่เป็น All Member + มี provider อื่น: dialog เลือกสมัครใหม่หรือกลับไปเลือกช่องทางเดิม
   - เบอร์ใหม่ หรือเงื่อนไขสร้าง phone login ใหม่: deleteAndCreateNewLoginPhone ตาม flow เดิม ห้าม Reuse Login เลือกสมัครใหม่เองเพียงเพื่อให้ผ่าน
4. Email: LoginEmailViewController รับ email + password → loginEmailSuccess ใน AuthenBaseViewModel → EmailOTPVerificationViewModel / BaseOTPVerificationViewController → ยืนยัน OTP → ขั้นตอน login ต่อ ไม่ใช่ email อย่างเดียว
5. Latest Login: provider ล่าสุด / provider ก่อนหน้า / ช่องทางอื่นใน bottom sheet; Phone ไป OTP ด้วยเบอร์ที่จำไว้ ส่วน Email ส่ง prefillEmail และแสดงแบบ masked
6. Facebook / Google / Apple: เริ่มจากปุ่มในแอปแล้วเรียก provider flow; หน้าของ SDK/ระบบ/เว็บภายนอกใส่ SharedElementIds ของเราไม่ได้ ต้องตรวจ driver hierarchy จริงแยกต่างหาก
7. หลัง credential สำเร็จยังมี postProviderLogin: บันทึก session, ตรวจ user/member, DataPrivacy/PDPA, email verification, Register7AppSuccess, RegisterAllMemberSuccess, SetPassword หรือ dismiss กลับหน้าที่เรียก ตามสถานะบัญชี ไม่รับประกันว่าจบที่ Home เสมอ
8. ทางแยกที่ต้องรู้จัก: forgot password / email not found / สมัคร email / ตรวจสมาชิก / สมัครสมาชิก / reset login / skip popup / consent / generic retry-error dialog

## หลักฐานหลัก

- [Authentication.swift:131](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Authentication.swift:131)
- [Scenes/Landing/LoginLandingViewModel.swift:195](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewModel.swift:195)
- [Scenes/Landing/LoginLandingViewModel.swift:220](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewModel.swift:220)
- [Scenes/SignInWithPhone/PhoneOTPViewModel.swift:103](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneOTPViewModel.swift:103)
- [Scenes/SignInWithPhone/PhoneSignInOTPViewModel.swift:170](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewModel.swift:170)
- [Scenes/LatestLoginLanding/LatestLoginLandingViewModel.swift:274](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewModel.swift:274)
- [Scenes/LoginEmail/LoginEmailViewModel.swift:170](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewModel.swift:170)
- [AuthenBaseViewModel.swift:432](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/AuthenBaseViewModel.swift:432)
- [AuthenBaseViewModel.swift:1141](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/AuthenBaseViewModel.swift:1141)
- [AuthenBaseViewModel.swift:1595](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/AuthenBaseViewModel.swift:1595)

## กติกา ID ที่เสนอ

- ใช้ lowerCamelCase: ชื่อหน้า + หน้าที่ + ชนิด UI; รายการด้านล่างเป็น proposal ยังไม่ได้ใส่ใน contract
- ปุ่ม/ช่องกรอก/ข้อความผิดพลาด/ข้อความยืนยันบัญชี/scroll container เป็นจุดหลัก ไม่จำเป็นต้องใส่ ID ให้เส้นคั่นหรือรูปตกแต่ง
- page marker ให้ผูกกับ view ที่ตรวจพบได้จริงใน accessibility tree ห้ามตั้ง parent เป็น accessibility element แล้วทำให้ลูกหายโดยไม่ตรวจ VoiceOver/Appium
- ตัวแปร IBOutlet เป็นหลักฐานจุดผูก ไม่ใช่ accessibilityIdentifier เดิม และ storyboardIdentifier ไม่ใช่ ID ที่ใช้หา element อัตโนมัติ
- PhoneSignInOTP และ BaseOTPVerification ใช้ OTPTextField หนึ่งช่อง วาด labels หลายหลัก กรอกด้วย ID ช่องเดียว
- ConfirmOTPViewController ของสมัครสมาชิกต่างออกไป: มี 6 ASOTPTextField จริง จึงระบุ ID แยก 6 ช่องได้ และมี resendOTPAction ใน storyboard ต้องผูกปุ่มจาก scene เพิ่ม
- Phone input มี formatPhoneNumber และ validation ลบขีดก่อนตรวจ; expectedValue ต้องสะท้อนรูปแบบแสดงจริง ห้ามถือว่าตรงกับ string ดิบเสมอ
- Latest email อาจ masked และ prefilled ต้องตรวจบัญชีจริงด้วยข้อมูลปลายทางที่เหมาะสม ไม่ใช้ masked text เป็นหลักฐานเดียว
- marker ที่หลายหน้ามองเห็นพร้อมกันระหว่าง transition ต้องมีเงื่อนไขรอหน้าคงที่; waitForAnyVisible ยังเป็นข้อเสนอ ไม่ได้ implement ใน Core
- ID บน component ร่วมควร inject ตาม scene/use case; ไม่ใส่ ID ของ Login แบบ global จน flow Profile/Reset ใช้ผิดความหมาย

## ตารางจุดผูก ID

ทุกหน้ามี marker และ controls ที่ตรวจพบใน source ด้านล่าง ชื่อที่สะท้อน outlet เป็นร่างให้ review ความหมายก่อนลงทะเบียนจริง

### loginPage

Source: `Landing/LoginLandingViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `loginPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:17) |
| `loginPagePhoneTextField` | `phoneTextField` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:19) |
| `loginPageSignInFaceBookButton` | `signInFaceBookButton` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:20) |
| `loginPageSignInGoogleButton` | `signInGoogleButton` | [บรรทัด 21](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:21) |
| `loginPageSignInAppleButton` | `signInAppleButton` | [บรรทัด 22](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:22) |
| `loginPageSignInEmailButton` | `signInEmailButton` | [บรรทัด 23](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:23) |
| `loginPageLoginButton` | `loginButton` | [บรรทัด 24](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:24) |
| `loginPageSkipButton` | `skipButton` | [บรรทัด 25](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:25) |
| `loginPagePhoneAlertLabel` | `phoneAlertLabel` | [บรรทัด 27](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:27) |
| `loginPageScrollView` | `scrollView` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:28) |
| `loginPagePrivacyNoticeButton` | `privacyNoticeButton` | [บรรทัด 30](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Landing/LoginLandingViewController.swift:30) |

### latestLoginPage

Source: `LatestLoginLanding/LatestLoginLandingViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `latestLoginPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:17) |
| `latestLoginPageBackButton` | `backButton` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:19) |
| `latestLoginPageLatestLoginUserNameLabel` | `latestLoginUserNameLabel` | [บรรทัด 21](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:21) |
| `latestLoginPageLatestLoginUserEmailLabel` | `latestLoginUserEmailLabel` | [บรรทัด 22](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:22) |
| `latestLoginPageLatestLoginLoginButton` | `latestLoginLoginButton` | [บรรทัด 24](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:24) |
| `latestLoginPageLatestLoginProviderNameLabel` | `latestLoginProviderNameLabel` | [บรรทัด 26](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:26) |
| `latestLoginPageLatestLoginPreviousLoginButton` | `latestLoginPreviousLoginButton` | [บรรทัด 27](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:27) |
| `latestLoginPageLatestLoginNormalLoginButton` | `latestLoginNormalLoginButton` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:28) |
| `latestLoginPageBottomSheetView` | `bottomSheetView` | [บรรทัด 31](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:31) |
| `latestLoginPageSheetFacebookLoginButton` | `sheetFacebookLoginButton` | [บรรทัด 35](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:35) |
| `latestLoginPageSheetGoogleLoginButton` | `sheetGoogleLoginButton` | [บรรทัด 36](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:36) |
| `latestLoginPageSheetAppleLoginButton` | `sheetAppleLoginButton` | [บรรทัด 37](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:37) |
| `latestLoginPageSheetEmailLoginButton` | `sheetEmailLoginButton` | [บรรทัด 38](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:38) |
| `latestLoginPageSheetPhoneLoginButton` | `sheetPhoneLoginButton` | [บรรทัด 39](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:39) |
| `latestLoginPageBottomSheetCancelButton` | `bottomSheetCancelButton` | [บรรทัด 40](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LatestLoginLanding/LatestLoginLandingViewController.swift:40) |

### loginEmailPage

Source: `LoginEmail/LoginEmailViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `loginEmailPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 24](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:24) |
| `loginEmailPageEmailTextField` | `emailTextField` | [บรรทัด 26](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:26) |
| `loginEmailPagePasswordTextField` | `passwordTextField` | [บรรทัด 27](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:27) |
| `loginEmailPageRegisterButton` | `registerButton` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:28) |
| `loginEmailPageForgotPasswordButton` | `forgotPasswordButton` | [บรรทัด 29](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:29) |
| `loginEmailPageLoginButton` | `loginButton` | [บรรทัด 30](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:30) |
| `loginEmailPageEmailAlertLabel` | `emailAlertLebel` | [บรรทัด 32](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:32) |
| `loginEmailPagePasswordAlertLabel` | `passwordAlertLebel` | [บรรทัด 34](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:34) |
| `loginEmailPageLoginFailAlert` | `loginFailAlert` | [บรรทัด 35](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/LoginEmail/LoginEmailViewController.swift:35) |

### loginPhoneOtpPage

Source: `SignInWithPhone/PhoneSignInOTPViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `loginPhoneOtpPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 10](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:10) |
| `loginPhoneOtpPageBackButton` | `backButton` | [บรรทัด 13](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:13) |
| `loginPhoneOtpPageMobileNoLabel` | `mobileNoLabel` | [บรรทัด 14](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:14) |
| `loginPhoneOtpPageOtpRefLabel` | `otpRefLabel` | [บรรทัด 15](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:15) |
| `loginPhoneOtpPageOtpTextField` | `otpTextField` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:16) |
| `loginPhoneOtpPageOtpAlertLabel` | `otpAlertLabel` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:17) |
| `loginPhoneOtpPageResendButton` | `resendButton` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SignInWithPhone/PhoneSignInOTPViewController.swift:18) |

### loginEmailOtpPage

Source: `EmailOTPVerify/BaseOTPVerificationViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `loginEmailOtpPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 12](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:12) |
| `loginEmailOtpPageBackButton` | `backButton` | [บรรทัด 15](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:15) |
| `loginEmailOtpPageContactInfoLabel` | `contactInfoLabel` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:16) |
| `loginEmailOtpPageOtpRefLabel` | `otpRefLabel` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:17) |
| `loginEmailOtpPageOtpTextField` | `otpTextField` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:18) |
| `loginEmailOtpPageOtpAlertLabel` | `otpAlertLabel` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:19) |
| `loginEmailOtpPageResendButton` | `resendButton` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/EmailOTPVerify/BaseOTPVerificationViewController.swift:20) |

### forgotPasswordPage

Source: `ForgetPassword/ForgotPasswordViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `forgotPasswordPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 12](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/ForgotPasswordViewController.swift:12) |
| `forgotPasswordPageEmailTextField` | `emailTextField` | [บรรทัด 14](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/ForgotPasswordViewController.swift:14) |
| `forgotPasswordPageEmailAlertLabel` | `emailAlertLebel` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/ForgotPasswordViewController.swift:16) |
| `forgotPasswordPageSendButton` | `sendButton` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/ForgotPasswordViewController.swift:18) |

### emailNotFoundPopup

Source: `ForgetPassword/NotFoundEmailViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `emailNotFoundPopupView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/NotFoundEmailViewController.swift:17) |
| `emailNotFoundPopupErrorMessage` | `errorMessage` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/NotFoundEmailViewController.swift:19) |
| `emailNotFoundPopupDismissOKButton` | `dismissOKButton` | [บรรทัด 21](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ForgetPassword/NotFoundEmailViewController.swift:21) |

### registerEmailPage

Source: `RegisterEmail/RegisterEmailViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `registerEmailPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:17) |
| `registerEmailPageEmailTextField` | `emailTextField` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:19) |
| `registerEmailPagePassTextField` | `passTextField` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:20) |
| `registerEmailPageConfirmPassTextField` | `confirmPassTextField` | [บรรทัด 21](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:21) |
| `registerEmailPageEmailAlertLabel` | `emailAlertLebel` | [บรรทัด 23](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:23) |
| `registerEmailPagePassAlertLabel` | `passAlertLebel` | [บรรทัด 25](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:25) |
| `registerEmailPageConfirmPassAlertLabel` | `confirmPassAlertLebel` | [บรรทัด 27](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:27) |
| `registerEmailPageSignupButton` | `signupButton` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:28) |
| `registerEmailPageDefaultAlertLabel` | `defaultAlertLebel` | [บรรทัด 29](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterEmail/RegisterEmailViewController.swift:29) |

### confirmEmailPage

Source: `ConfirmEmail/EmailConfirmViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `confirmEmailPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmEmail/EmailConfirmViewController.swift:17) |
| `confirmEmailPageEmailLabel` | `emailLabel` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmEmail/EmailConfirmViewController.swift:20) |
| `confirmEmailPageResendButton` | `resendButton` | [บรรทัด 21](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmEmail/EmailConfirmViewController.swift:21) |
| `confirmEmailPageCancelEmailButton` | `cancelEmailButton` | [บรรทัด 22](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmEmail/EmailConfirmViewController.swift:22) |

### verifyMemberPage

Source: `AllMember/VerifyAllmemberViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `verifyMemberPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 12](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:12) |
| `verifyMemberPageThaiIdAlertLabel` | `thaiIdAlertLabel` | [บรรทัด 15](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:15) |
| `verifyMemberPageThaiIdTextField` | `thaiIdTextField` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:16) |
| `verifyMemberPageNextButton` | `nextButton` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:18) |
| `verifyMemberPageMobileNoLabel` | `mobileNoLabel` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:19) |
| `verifyMemberPageBackButton` | `backButton` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/VerifyAllmemberViewController.swift:20) |

### checkMemberPage

Source: `AllMember/CheckAllMemberViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `checkMemberPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 15](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:15) |
| `checkMemberPageScrollView` | `scrollView` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:17) |
| `checkMemberPageRegisterTitle` | `registerTitle` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:19) |
| `checkMemberPageRegisterSubTitle` | `registerSubTitle` | [บรรทัด 20](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:20) |
| `checkMemberPageMobileNoTextField` | `mobileNoTextField` | [บรรทัด 24](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:24) |
| `checkMemberPageMobileNoAlertLabel` | `mobileNoAlertLabel` | [บรรทัด 25](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:25) |
| `checkMemberPageIdNoAlertLabel` | `idNoAlertLabel` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:28) |
| `checkMemberPageIdNoTextField` | `idNoTextField` | [บรรทัด 29](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:29) |
| `checkMemberPageThaiButton` | `thaiButton` | [บรรทัด 31](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:31) |
| `checkMemberPageForeignerButton` | `foreignerButton` | [บรรทัด 32](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:32) |
| `checkMemberPageNextButton` | `nextButton` | [บรรทัด 33](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:33) |
| `checkMemberPageSkipButton` | `skipButton` | [บรรทัด 34](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/AllMember/CheckAllMemberViewController.swift:34) |

### registerMemberPage

Source: `PreRegisterAllMember/PreRegisterViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `registerMemberPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:28) |
| `registerMemberPageBackButton` | `backButton` | [บรรทัด 38](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:38) |
| `registerMemberPageNameTextField` | `nameTextField` | [บรรทัด 41](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:41) |
| `registerMemberPageSurnameTextField` | `surnameTextField` | [บรรทัด 42](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:42) |
| `registerMemberPageLaserTextField` | `laserTextField` | [บรรทัด 43](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:43) |
| `registerMemberPageBranchTextField` | `branchTextField` | [บรรทัด 44](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:44) |
| `registerMemberPageDateTextField` | `dateTextField` | [บรรทัด 45](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:45) |
| `registerMemberPageMaleButton` | `maleBtn` | [บรรทัด 46](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:46) |
| `registerMemberPageFemaleButton` | `femaleBtn` | [บรรทัด 47](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:47) |
| `registerMemberPageUnsignButton` | `unsignBtn` | [บรรทัด 48](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:48) |
| `registerMemberPageTermConButton` | `termConBtn` | [บรรทัด 49](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:49) |
| `registerMemberPageIdentInfoButton` | `identInfoBtn` | [บรรทัด 52](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:52) |
| `registerMemberPageRegisterButton` | `registerBtn` | [บรรทัด 57](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:57) |
| `registerMemberPageWarningBranchLabel` | `warningBranchLabel` | [บรรทัด 59](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:59) |
| `registerMemberPageScrollView` | `scrollView` | [บรรทัด 60](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:60) |
| `registerMemberPageNameAlertLabel` | `nameAlertLabel` | [บรรทัด 66](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:66) |
| `registerMemberPageSurnameAlertLabel` | `surnameAlertLabel` | [บรรทัด 67](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:67) |
| `registerMemberPageBackCardAlertLabel` | `backCardAlertLabel` | [บรรทัด 68](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:68) |
| `registerMemberPageDateAlertLabel` | `dateAlertLabel` | [บรรทัด 69](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:69) |
| `registerMemberPageGenderAlertLabel` | `genderAlertLabel` | [บรรทัด 70](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:70) |
| `registerMemberPageStaffNumberTextField` | `staffNumberTextField` | [บรรทัด 82](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:82) |
| `registerMemberPageStaffAlertLabel` | `staffAlertLabel` | [บรรทัด 83](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:83) |
| `registerMemberPageSkipButton` | `skipButton` | [บรรทัด 87](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/PreRegisterAllMember/PreRegisterViewController.swift:87) |

### registerMemberOtpPage

Source: `ConfirmOTP/ConfirmOTPViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `registerMemberOtpPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 13](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:13) |
| `registerMemberOtpPageBackButton` | `backButton` | [บรรทัด 24](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:24) |
| `registerMemberOtpPagePhoneLabel` | `phoneLabel` | [บรรทัด 25](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:25) |
| `registerMemberOtpPageFirstDigitTextField` | `firstDigitTextfield` | [บรรทัด 26](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:26) |
| `registerMemberOtpPageSecondDigitTextField` | `secondDigitTextfield` | [บรรทัด 27](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:27) |
| `registerMemberOtpPageThirdDigitTextField` | `thirdDigitTextfield` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:28) |
| `registerMemberOtpPageFourthDigitTextField` | `fourthDigitTextfield` | [บรรทัด 29](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:29) |
| `registerMemberOtpPageFifthDigitTextField` | `fifthDigitTextfield` | [บรรทัด 30](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:30) |
| `registerMemberOtpPageSixthDigitTextField` | `sixthDigitTextfield` | [บรรทัด 31](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:31) |
| `registerMemberOtpPageOTPAlertLabel` | `OTPAlertLabel` | [บรรทัด 32](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:32) |
| `registerMemberOtpPageRefNumLabel` | `refNumLbl` | [บรรทัด 33](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:33) |
| `registerMemberOtpPageHeaderLabel` | `headerLabel` | [บรรทัด 35](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ConfirmOTP/ConfirmOTPViewController.swift:35) |

### resetLoginPopup

Source: `ResetPopup/ResetLoginPopupViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `resetLoginPopupView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 14](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ResetPopup/ResetLoginPopupViewController.swift:14) |
| `resetLoginPopupConfirmButton` | `confirmButton` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ResetPopup/ResetLoginPopupViewController.swift:16) |
| `resetLoginPopupSubtitleLabel` | `subtitleLabel` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ResetPopup/ResetLoginPopupViewController.swift:17) |
| `resetLoginPopupTitleLabel` | `titleLabel` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ResetPopup/ResetLoginPopupViewController.swift:18) |
| `resetLoginPopupSkipButton` | `skipButton` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/ResetPopup/ResetLoginPopupViewController.swift:19) |

### setPasswordPage

Source: `SetPassword/SetPasswordViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `setPasswordPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 15](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:15) |
| `setPasswordPagePasswordTextField` | `passwordTextField` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:16) |
| `setPasswordPageConfirmButton` | `confirmButton` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:17) |
| `setPasswordPageConfirmPasswordTextField` | `confirmPasswordTextField` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:18) |
| `setPasswordPagePasswordAlertLabel` | `passwordAlertLabel` | [บรรทัด 28](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:28) |
| `setPasswordPageConfirmAlertLabel` | `confirmAlertLabel` | [บรรทัด 29](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:29) |
| `setPasswordPageTitleLabel` | `titleLabel` | [บรรทัด 31](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:31) |
| `setPasswordPageSubTitleLabel` | `subTitleLabel` | [บรรทัด 32](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:32) |
| `setPasswordPageYourEmailLabel` | `yourEmailLabel` | [บรรทัด 33](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:33) |
| `setPasswordPageEmailLabel` | `emailLabel` | [บรรทัด 34](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:34) |
| `setPasswordPageCloseButton` | `closeButton` | [บรรทัด 35](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SetPassword/SetPasswordViewController.swift:35) |

### skipLoginPopup

Source: `SkipPopup/PopupSkipAuthenViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `skipLoginPopupView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 25](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SkipPopup/PopupSkipAuthenViewController.swift:25) |
| `skipLoginPopupRegisterButton` | `registerButton` | [บรรทัด 33](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SkipPopup/PopupSkipAuthenViewController.swift:33) |
| `skipLoginPopupSevenPopupView` | `sevenPopupView` | [บรรทัด 34](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SkipPopup/PopupSkipAuthenViewController.swift:34) |
| `skipLoginPopupMemberPopupView` | `memberPopupView` | [บรรทัด 35](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/SkipPopup/PopupSkipAuthenViewController.swift:35) |

### register7AppSuccessPage

Source: `Register7AppSuccess/Register7AppSuccessViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `register7AppSuccessPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 14](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Register7AppSuccess/Register7AppSuccessViewController.swift:14) |
| `register7AppSuccessPageRegisterButton` | `registerButton` | [บรรทัด 16](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Register7AppSuccess/Register7AppSuccessViewController.swift:16) |
| `register7AppSuccessPageForeignerRegisterButton` | `foreignerRegisterBtn` | [บรรทัด 17](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Register7AppSuccess/Register7AppSuccessViewController.swift:17) |
| `register7AppSuccessPageSkipButton` | `skipButton` | [บรรทัด 18](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Register7AppSuccess/Register7AppSuccessViewController.swift:18) |
| `register7AppSuccessPageScrollView` | `scrollView` | [บรรทัด 19](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/Register7AppSuccess/Register7AppSuccessViewController.swift:19) |

### registerMemberSuccessPage

Source: `RegisterAllMemberSuccess/RegisterMemberSuccessViewController.swift`

| ID ที่เสนอ | ตัวแปร / จุดผูก | Source |
|---|---|---|
| `registerMemberSuccessPageView` | `view (page marker; verify accessibility hierarchy)` | [บรรทัด 11](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterAllMemberSuccess/RegisterMemberSuccessViewController.swift:11) |
| `registerMemberSuccessPageRegisterWalletButton` | `registerWalletButton` | [บรรทัด 13](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterAllMemberSuccess/RegisterMemberSuccessViewController.swift:13) |
| `registerMemberSuccessPageSkipRegisterTMWButton` | `skipRegisterTMWButton` | [บรรทัด 14](/Users/chanoncha/7-eleven-ios/Modules/Authentication/Authentication/Classes/Scenes/RegisterAllMemberSuccess/RegisterMemberSuccessViewController.swift:14) |

## จุดที่ต้องไล่ UI จริงต่อก่อนประกาศว่าครบทุก flow

- DataPrivacy/UnityPDPA และ consent: AuthenBaseViewModel เรียกข้าม module ต้องตรวจหน้าที่ build/environment เปิดใช้จริง รวมปุ่มยอมรับ/ปฏิเสธ/ปิดและ scroll terms
- BasicScene.alert / alertWithRetry: เป็น component ร่วม ต้องกำหนด popup marker, title/message และ action ID ตาม callback จริง ห้ามใช้ปุ่มซ้าย=ยกเลิก ปุ่มขวา=ยืนยันเป็นกฎตายตัว
- ปุ่ม back ที่สร้างจาก navigation bar, keyboard Done, password visibility toggle และ resend ที่ต่อด้วย IBAction: ต้องไล่ storyboard/custom component และ accessibility tree เพิ่ม ไม่ปรากฏเป็น IBOutlet ทุกตัว
- SDK Facebook/Google/Apple, system permission และ external browser: แยก strategy locator จาก ID ของแอป
- หน้าเก่า AuthenLanding และ profile/link/unlink มีโค้ดร่วม แต่ไม่ได้ถือว่าเป็นหน้าเริ่มต้น active ของภาพนี้; ต้องทดสอบ call sites ถ้าจะใส่ ID ใน component ร่วม
- จุดยืนยัน login สำเร็จ: ต้องเลือก marker และข้อมูลบัญชีบนหน้าปลายทางของ testcase ไม่ใช้แค่ OTP หายหรือหน้า Home แสดง เพราะ guest ก็อาจเข้าถึงได้
- รายละเอียด backend/remote config และสถานะบัญชีจริงไม่อาจยืนยันจาก static code; ไม่ได้ยิง OTP, login, สมัครสมาชิก หรือเปลี่ยนข้อมูลบัญชีในการตรวจนี้

## ข้อมูล Reuse Login ที่ต้องกำหนด

shouldLogin, loginMethod และ phoneNumber/email เป็นจุดเริ่มต้น แต่ Email ต้องมี password และทั้ง Phone/Email ต้องมีวิธีรับ OTP ที่ทีมรองรับ ไม่ใส่รหัสจริงลง repo
ควรกำหนด expected account/state หลังสำเร็จ และยอมรับทางแยกใดบ้าง โดย flow สมัครใหม่/ย้ายบัญชี/consent ไม่ควรถูกกดผ่านอัตโนมัติโดยไม่ระบุไว้ใน testcase

## ลำดับลงมือ

1. ใส่ ID ของ loginPage, latestLoginPage, loginPhoneOtpPage, loginEmailPage และ loginEmailOtpPage ก่อน
2. ผูก ID ใน Swift หลัง outlet พร้อมใช้งาน แล้วตรวจ Appium hierarchy ว่าพบจริง ไม่ซ้ำ และยังเข้าถึง child elements ได้
3. เพิ่ม marker และ action ของทางแยกที่บัญชีทดสอบพบจริง (สมาชิก/consent/popup) ตามเอกสาร QA
4. ค่อยเพิ่มรายการที่อนุมัติลง IDFile, generate และอัปเดต version/commit ของ consumer ก่อนเขียน Reuse Login

ไฟล์ login-id-proposal.json เป็น mapping draft สำหรับ review ไม่ใช่ element-ids.json ที่พร้อมนำไปแทนต้นฉบับ
