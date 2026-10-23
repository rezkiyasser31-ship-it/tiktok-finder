# Testing on Android: Complete Beginner's Guide 📱

This guide explains how to get **TikTok Finder** running on your Android phone step-by-step.

---

## 📌 System Status (Automated Setup Complete! 🎉)
* **Android SDK & ADB**: Installed at `C:\Users\yasser\AppData\Local\Android\Sdk`.
* **cmdline-tools & NDK**: Android Command-line tools and NDK `27.1.12297006` installed and licenses accepted.
* **Java**: Eclipse Temurin **JDK 17** is installed and configured (`JAVA_HOME`).
* **Environment**: `ANDROID_HOME`, `JAVA_HOME`, and `platform-tools` are permanently added to your User PATH.
* **Pre-compiled APK Ready**: A complete debug APK has already been built and is located at:
  `android\app\build\outputs\apk\debug\app-debug.apk`

---

## Step 1: Connect Your Phone & Enable USB Debugging

1. On your Android phone, open **Settings**.
2. Scroll to the bottom and tap **About phone** (or **System** → **About phone**).
3. Find **Build number** and tap it **7 times** quickly.
   * You will see a notification: *"You are now a developer!"*
4. Go back to **Settings** → **Developer options** (or search "Developer options" in Settings).
5. Toggle on **USB debugging**.
6. Plug your phone into your PC with a USB cable.
   * In your phone's notification shade, set the USB mode to **File Transfer / MTP** (not charging only).
7. Unlock your phone. When the prompt **"Allow USB debugging from this computer?"** appears:
   * Check **"Always allow from this computer"**
   * Tap **Allow**.

---

## Step 2: Install the App Directly onto Your Phone (1 Command)

With your phone plugged in and unlocked, open PowerShell and run:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "C:\Users\yasser\Desktop\antigravity\tikok finder\android\app\build\outputs\apk\debug\app-debug.apk"
```

Once installed, launch it:
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -n com.yasser.tiktokfinder/.MainActivity
```

*(Alternative: You can also copy `android\app\build\outputs\apk\debug\app-debug.apk` directly to your phone's storage via Windows File Explorer and tap it to install!)*

---

## Step 3: Run with Metro Dev Server (Live Reload & Fast Refresh)

Whenever you want to develop or run with live reload:

1. In PowerShell, navigate to the project directory:
   ```powershell
   cd "C:\Users\yasser\Desktop\antigravity\tikok finder"
   ```
2. Start the Metro development bundler:
   ```powershell
   npx expo start --dev-client
   ```
3. Open the **TikTok Finder** app on your phone. It will automatically connect to your Metro bundler!

---

## 🎯 Testing the Share Sheet

1. Open the **TikTok app** on your phone.
2. Find any video sliced into parts (e.g. "Part 2", "pt. 3").
3. Tap the **Share** button on the right side of the screen.
4. Scroll the share options horizontally to the end and tap **More**.
5. Select **TikTok Finder** from the list of apps.
6. TikTok Finder will open automatically, clean the title, query YouTube, and show you the original long YouTube video!
7. You can also share a **screenshot** directly to the app; it will run on-device ML Kit OCR to read the video title from the image!
