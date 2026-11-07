@echo off

chcp 65001 >nul

net session >nul 2>&1

if %errorlevel% neq 0 (
    echo Requesting administrator permission...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title Elysia Memory Installer

set "B64=%TEMP%\elysia-setup.b64"
set "PS1=%TEMP%\elysia-setup.ps1"

> "%B64%" echo -----BEGIN CERTIFICATE-----
>>"%B64%" echo 77u/IyAtKi0gY29kaW5nOiB1dGYtOCAtKi0KIyDljIU177ya54us56uL5a6J6KOF6ZW/5pyf6K6w5b+GIGJ1bmRsZe+8jOS4jeS/
>>"%B64%" echo ruaUueS6uuagvCBwcmVzZXTvvIzkuI3lronoo4Xov5DooYzml7bkvp3otZbjgIIKJEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICdT
>>"%B64%" echo dG9wJwokQ3lhbiA9ICdDeWFuJzsgJEdyZWVuID0gJ0dyZWVuJzsgJFllbGxvdyA9ICdZZWxsb3cnCmZ1bmN0aW9uIFNheSgkbSwg
>>"%B64%" echo JGMgPSAkQ3lhbikgeyBXcml0ZS1Ib3N0ICIgICRtIiAtRm9yZWdyb3VuZENvbG9yICRjIH0KClNheSAn5YyFNSDCtyDplb/mnJ/o
>>"%B64%" echo rrDlv4blronoo4UnCiMg5LiO5YyFMyDkv53mjIHlkIzkuIDkuKrlronoo4XmoLnvvJvmj5Lku7bmmK/ni6znq4vnmoQgcHJvZmls
>>"%B64%" echo ZSBidW5kbGXjgIIKJGJhc2UgPSAnRDpcQUlcSkFSVklTJwokc2NyaXB0RGlyID0gKCRhcmdzWzBdIC1yZXBsYWNlICciJywgJycp
>>"%B64%" echo LlRyaW1FbmQoJ1wnKQokZHNoSG9tZSA9IGlmICgkZW52OkRTSF9IT01FKSB7ICRlbnY6RFNIX0hPTUUgfSBlbHNlIHsgSm9pbi1Q
>>"%B64%" echo YXRoICRlbnY6VVNFUlBST0ZJTEUgJy5kc2gnIH0KCnRyeSB7CiAgICBpZiAoLW5vdCAoR2V0LUNvbW1hbmQgZHNoIC1FcnJvckFj
>>"%B64%" echo dGlvbiBTaWxlbnRseUNvbnRpbnVlKSkgewogICAgICAgIFNheSAn5pyq5qOA5rWL5YiwIGRzaO+8jOivt+WFiOWuieijheWMhTHj
>>"%B64%" echo gILorrDlv4bmj5Lku7bmsqHoo4XkuIrvvIzlhbbkvZnlip/og73kuI3lj5flvbHlk43jgIInICRZZWxsb3cKICAgICAgICBSZWFk
>>"%B64%" echo LUhvc3QgJ+aMieWbnui9puWFs+mXrScKICAgICAgICBleGl0IDAKICAgIH0KCiAgICAjIOWFiOajgOafpSBwcm9maWxl77yM5YaN
>>"%B64%" echo 5aSN5Yi25paH5Lu277yb5bey5pyJIEdpdEh1YiDmiJbmnKzlnLDmnaXmupDpg73ot7Pov4fvvIzkuI3opobnm5bnlKjmiLfljp/l
>>"%B64%" echo ronoo4XjgIIKICAgICRwcm9maWxlTWFuaWZlc3QgPSBKb2luLVBhdGggJGRzaEhvbWUgJ3Byb2ZpbGVzXHdlYlxwYWNrYWdlLmpz
>>"%B64%" echo b24nCiAgICBpZiAoVGVzdC1QYXRoIC1MaXRlcmFsUGF0aCAkcHJvZmlsZU1hbmlmZXN0KSB7CiAgICAgICAgJHByb2ZpbGUgPSBH
>>"%B64%" echo ZXQtQ29udGVudCAtTGl0ZXJhbFBhdGggJHByb2ZpbGVNYW5pZmVzdCAtUmF3IHwgQ29udmVydEZyb20tSnNvbgogICAgICAgIGlm
>>"%B64%" echo ICgkcHJvZmlsZS5kZXBlbmRlbmNpZXMgLWFuZCAkcHJvZmlsZS5kZXBlbmRlbmNpZXMuUFNPYmplY3QuUHJvcGVydGllcy5OYW1l
>>"%B64%" echo IC1jb250YWlucyAnZHNoLW1lbW9yeScpIHsKICAgICAgICAgICAgU2F5ICflt7Loo4Xov4fvvIzot7Pov4cnICRHcmVlbgogICAg
>>"%B64%" echo ICAgICAgICBSZWFkLUhvc3QgJ+aMieWbnui9puWFs+mXrScKICAgICAgICAgICAgZXhpdCAwCiAgICAgICAgfQogICAgfQoKICAg
>>"%B64%" echo ICRwbHVnaW5EaXIgPSBKb2luLVBhdGggJGJhc2UgJ2RzaC1tZW1vcnknCiAgICAkcGF5bG9hZCA9IEpvaW4tUGF0aCAkc2NyaXB0
>>"%B64%" echo RGlyICdtb2RzXG1lbW9yeScKICAgIGlmICgtbm90IChUZXN0LVBhdGggLUxpdGVyYWxQYXRoIChKb2luLVBhdGggJHBheWxvYWQg
>>"%B64%" echo J3BhY2thZ2UuanNvbicpKSkgewogICAgICAgIHRocm93ICflronoo4XljIXnvLrlsJEgbW9kcy9tZW1vcnkvcGFja2FnZS5qc29u
>>"%B64%" echo JwogICAgfQogICAgTmV3LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAtUGF0aCAkcGx1Z2luRGlyIC1Gb3JjZSB8IE91dC1OdWxs
>>"%B64%" echo CiAgICBDb3B5LUl0ZW0gKEpvaW4tUGF0aCAkcGF5bG9hZCAnKicpICRwbHVnaW5EaXIgLVJlY3Vyc2UgLUZvcmNlCiAgICAjIGRz
>>"%B64%" echo aC1tZW1vcnkg6Zu26L+Q6KGM5pe25L6d6LWW77yM5LiN6L+Q6KGMIG5wbSBpbnN0YWxs44CCCiAgICAkcGx1Z2luRGlyU2xhc2gg
>>"%B64%" echo PSAkcGx1Z2luRGlyLlJlcGxhY2UoJ1wnLCAnLycpCiAgICBjbWQgL2MgImRzaCBwbHVnaW4gLS1wcm9maWxlIHdlYiBhZGQgYCIk
>>"%B64%" echo cGx1Z2luRGlyU2xhc2hgIiAyPiYxIgogICAgaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsKICAgICAgICBTYXkgJ+iusOW/huaP
>>"%B64%" echo kuS7tuayoeijheS4iu+8jOWFtuS9meWKn+iDveS4jeWPl+W9seWTjeOAguivt+ajgOafpeS4iuaWuemUmeivr+WQjumHjeivleOA
>>"%B64%" echo gicgJFllbGxvdwogICAgfSBlbHNlIHsKICAgICAgICBTYXkgJ+iusOW/huaPkuS7tuW3sui/myB3ZWIgcHJvZmlsZeOAguivt+mH
>>"%B64%" echo jeWQryBkc2ggd2Vi44CCJyAkR3JlZW4KICAgICAgICBTYXkgJ+WPr+WcqOengeiBiuS4reivt+axguiusOW9leS4gOadoeS6i+Wu
>>"%B64%" echo nu+8jOaIluaJi+WKqOiwg+eUqCBtZW1vcnlfb3JnYW5pemXjgIInCiAgICAgICAgU2F5ICfoh6rliqjmlbTnkIbpnIDopoEgc2No
>>"%B64%" echo ZWR1bGUg5pyN5Yqh77yb5pys5YyF6ZKJ5L2P54mI5pys55qEIHdlYiBwcm9maWxlIOayoeacieivpeacjeWKoeOAgicgJFllbGxv
>>"%B64%" echo dwogICAgfQp9IGNhdGNoIHsKICAgIFNheSAi6K6w5b+G5o+S5Lu25rKh6KOF5LiK77yM5YW25L2Z5Yqf6IO95LiN5Y+X5b2x5ZON
>>"%B64%" echo 44CCJCgkXy5FeGNlcHRpb24uTWVzc2FnZSkiICRZZWxsb3cKfQpSZWFkLUhvc3QgJ+aMieWbnui9puWFs+mXrScKZXhpdCAwCg==
>>"%B64%" echo -----END CERTIFICATE-----

certutil -decode -f "%B64%" "%PS1%" >nul 2>&1

if not exist "%PS1%" (
    echo Decode failed. Please run as administrator.
    pause
    exit /b 1
)

pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" "%CD%"
popd

del "%B64%" "%PS1%" >nul 2>&1

pause
