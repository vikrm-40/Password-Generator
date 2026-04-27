# Password-Generator
Secure Solari-style password generator


## 🔴🟡🟢 Status Indicator LEDs

The three LED indicators in the top-right corner of the application act as a 
real-time security status panel, inspired by classic Solari departure boards 
and industrial control panels.

### LED 1 — Activity Indicator (Left)

| State        | LED Color    | Meaning                                              |
|--------------|--------------|------------------------------------------------------|
| App opened   | ⚫ Off        | Application is idle, waiting for user action         |
| Generating   | 🟡 Amber      | Password is actively being generated (flip animation)|
| Done         | ⚫ Off        | Generation complete, hands off to LED 2              |


### LED 2 — Password Ready Indicator (Middle)

| State              | LED Color  | Meaning                                          |
|--------------------|------------|--------------------------------------------------|
| No password yet    | ⚫ Off      | No password has been generated in this session   |
| Password ready     | 🟢 Green    | Password generated successfully and ready to use |
| Cleared / Reset    | ⚫ Off      | Password has been cleared, session reset          |


### LED 3 — Security Health Indicator (Right)

| State                              | LED Color  | Meaning                                                              |
|------------------------------------|------------|----------------------------------------------------------------------|
| Idle / Safe                        | ⚫ Off      | No security concerns — clipboard clean, password masked              |
| Clipboard hot (after copy)         | 🟡 Amber    | Password is still in the clipboard — wipe after pasting             |
| Password revealed (eye open)       | 🟡 Amber    | Password is visible on screen — shoulder surfing risk               |
| Clipboard hot AND password visible | 🟡 Amber    | Double risk — password is both visible and in the clipboard         |
| Clipboard wipe failed              | 🔴 Red      | Wipe operation was blocked — clear clipboard manually               |
| Clipboard wiped + masked           | ⚫ Off      | All clear — clipboard clean and password hidden                     |


### Combined State Summary

| LED 1  | LED 2  | LED 3  | What is happening                                         |
|--------|--------|--------|-----------------------------------------------------------|
| ⚫ Off  | ⚫ Off  | ⚫ Off  | App just opened, idle, or fully cleared                   |
| 🟡 Amber| ⚫ Off  | ⚫ Off  | Password is being generated                               |
| ⚫ Off  | 🟢 Green| ⚫ Off  | Password ready, masked, clipboard clean — all safe        |
| ⚫ Off  | 🟢 Green| 🟡 Amber| Password ready but clipboard is hot or password is visible|
| ⚫ Off  | 🟢 Green| 🔴 Red  | Password ready but a clipboard wipe error occurred        |
| ⚫ Off  | ⚫ Off  | ⚫ Off  | Session cleared — clean slate                             |

---

### Quick Reference

| Color  | Always means                        |
|--------|-------------------------------------|
| ⚫ Off  | Idle or safe — no action needed     |
| 🟡 Amber| Attention — a security risk is active|
| 🟢 Green| Success — action completed safely   |
| 🔴 Red  | Error — manual intervention needed  |


