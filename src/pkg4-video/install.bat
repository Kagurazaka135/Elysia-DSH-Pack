@echo off

chcp 65001 >nul

net session >nul 2>&1

if %errorlevel% neq 0 (
    echo Requesting administrator permission...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title Elysia Installer

set "B64=%TEMP%\elysia-setup.b64"
set "PS1=%TEMP%\elysia-setup.ps1"

> "%B64%" echo -----BEGIN CERTIFICATE-----
>>"%B64%" echo 77u/IyAtKi0gY29kaW5nOiB1dGYtOCAtKi0KIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0
>>"%B64%" echo 9PT09PT09PT09PT0KIyAg5YyFNCDCtyDop4bpopHnkIbop6Mg5LiA6ZSu5a6J6KOFCiMgIOWJjeaPkDog5bey6KOFIOWMhTEgKOaguO
>>"%B64%" echo W/g+WMhSkg5LiUIGRzaCB3ZWIg6IO95q2j5bi46LW3CiMgIOeUqOazlTog5Y+M5Ye7IGluc3RhbGwuYmF0CiMgIOWKn+iDvTog54ix6
>>"%B64%" echo I6J55yL6KeG6aKRICjlhoXlrrnmgLvnu5Mv5oq95binL+WcuuaZr+ajgOa1iy9HSUYv5YWD5pWw5o2uKQojICDkvp3otZY6IGZmbXBl
>>"%B64%" echo ZyArIGZmcHJvYmUg5b+F6aG75Zyo57O757ufIFBBVEggKOiEmuacrOajgOafpeW5tue7meaMh+W8lSwg5LiN6Ieq5Yqo6KOFKQojID0
>>"%B64%" echo 9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQokRXJyb3JBY3Rpb25QcmVmZX
>>"%B64%" echo JlbmNlID0gJ1N0b3AnCiRDeWFuID0gJ0N5YW4nOyAkR3JlZW4gPSAnR3JlZW4nOyAkWWVsbG93ID0gJ1llbGxvdyc7ICRQaW5rID0gJ
>>"%B64%" echo 01hZ2VudGEnCmZ1bmN0aW9uIFNheSgkbSwgJGMgPSAkQ3lhbikgeyBXcml0ZS1Ib3N0ICIgICRtIiAtRm9yZWdyb3VuZENvbG9yICRj
>>"%B64%" echo IH0KClNheSAn4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pW
>>"%B64%" echo Q4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQJyAkUGluawpTYXkgJyAg54ix6I6J6KeG6aKR55CG6K
>>"%B64%" echo ejIMK3IOS4gOmUruWuieijhScgJFBpbmsKU2F5ICfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDil
>>"%B64%" echo ZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAnICRQaW5rClNh
>>"%B64%" echo eSAnJwoKJGJhc2UgPSAnRDpcQUlcSkFSVklTJwokc2NyaXB0RGlyID0gKCRhcmdzWzBdIC1yZXBsYWNlICciJywgJycpLlRyaW1FbmQ
>>"%B64%" echo oJ1wnKQpOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRiYXNlIC1Gb3JjZSB8IE91dC1OdWxsCgojIC0tLS0tLS0tLS
>>"%B64%" echo 0gWzEvNF0g546v5aKD5qOA5p+lIC0tLS0tLS0tLS0KU2F5ICdbMS80XSDmo4Dmn6Xnjq/looMgLi4uJwppZiAoLW5vdCAoR2V0LUNvb
>>"%B64%" echo W1hbmQgZHNoIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKSkgewogICAgU2F5ICcgIOacquajgOa1i+WIsCBEU0gsIOivt+WF
>>"%B64%" echo iOWuieijhSDljIUxICjmoLjlv4PljIUpIScgJFllbGxvdwogICAgUmVhZC1Ib3N0ICfmjInlm57ovabpgIDlh7onOyBleGl0IDEKfQo
>>"%B64%" echo jIGRzaCDnmoTmj5Lku7bnrqHnkIblhoXpg6jovazlj5Hnu5kgcG5wbSwg5rKh5pyJIHBucG0g5Lya55u05o6l5aSx6LSlIChleGl0ID
>>"%B64%" echo EyNykKaWYgKC1ub3QgKEdldC1Db21tYW5kIHBucG0gLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUpKSB7CiAgICBTYXkgJyAg5
>>"%B64%" echo pyq5qOA5rWL5YiwIHBucG0sIOato+WcqOWuieijhSAuLi4nICRZZWxsb3cKICAgIGNtZCAvYyAibnBtIGluc3RhbGwgLWcgcG5wbSA+
>>"%B64%" echo bnVsIDI+JjEiCiAgICBpZiAoLW5vdCAoR2V0LUNvbW1hbmQgcG5wbSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSkpIHsKICA
>>"%B64%" echo gICAgICBTYXkgJyAgISEgcG5wbSDoo4XkuI3kuIosIOivt+aJi+WKqOaJp+ihjDogbnBtIGluc3RhbGwgLWcgcG5wbScgJFllbGxvdw
>>"%B64%" echo ogICAgICAgIFJlYWQtSG9zdCAn5oyJ5Zue6L2m6YCA5Ye6JzsgZXhpdCAxCiAgICB9Cn0KU2F5ICcgIE9LIGRzaCArIHBucG0g6YO95
>>"%B64%" echo ZyoJyAkR3JlZW4KCiMgZmZtcGVnIC8gZmZwcm9iZSDmmK/op4bpopHlip/og73nmoTlkb3moLnlrZA6IOayoeacieWug+aPkuS7tueF
>>"%B64%" echo p+agt+WKoOi9vSwg5L2G5bel5YW35LiA6LCD5bCx5oql6ZSZ44CCCiMg5Y+q5o+Q56S65LiN6Ieq5Yqo6KOFIOKAlOKAlCBmZm1wZWc
>>"%B64%" echo g5L2T56ev5aSn44CB6KOF5rOV5aSa44CB6Ieq5Yqo6KOF5a655piT57+76L2mLCDorqnnlKjmiLfmiYvliqjjgIIKJGZmID0gR2V0LU
>>"%B64%" echo NvbW1hbmQgZmZtcGVnIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlCiRmcCA9IEdldC1Db21tYW5kIGZmcHJvYmUgLUVycm9yQ
>>"%B64%" echo WN0aW9uIFNpbGVudGx5Q29udGludWUKaWYgKC1ub3QgJGZmIC1vciAtbm90ICRmcCkgewogICAgU2F5ICcnICRZZWxsb3cKICAgIFNh
>>"%B64%" echo eSAnICDmnKrmo4DmtYvliLAgZmZtcGVnIC8gZmZwcm9iZSDigJTigJQg6KeG6aKR5Yqf6IO95b+F6aG75L6d6LWW5a6DIScgJFllbGx
>>"%B64%" echo vdwogICAgU2F5ICcgIOayoeacieeahOivnTog5o+S5Lu26IO96KOF5LiKLCDkvYbmir3luKcvR0lGL+aAu+e7k+exu+W3peWFt+S4gO
>>"%B64%" echo eUqOWwseaKpemUmeOAgicgJFllbGxvdwogICAgU2F5ICcgIOivt+aJi+WKqOWuieijhSAo5LqM6YCJ5LiAKTonICRZZWxsb3cKICAgI
>>"%B64%" echo FNheSAnICAgIDEuIOaWsOW8gOS4gOS4quWRveS7pOihjOeql+WPo+aJp+ihjDogIHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnJyAk
>>"%B64%" echo WWVsbG93CiAgICBTYXkgJyAgICAgICDoo4XlrozopoHph43lvIDnqpflj6MgKOiuqSBQQVRIIOeUn+aViCknICRZZWxsb3cKICAgIFN
>>"%B64%" echo heSAnICAgIDIuIOaIluWIsCBodHRwczovL3d3dy5neWFuLmRldi9mZm1wZWcvYnVpbGRzLyDkuIvovb0nICRZZWxsb3cKICAgIFNheS
>>"%B64%" echo AnICAgICAgIHJlbGVhc2UtZXNzZW50aWFscy56aXAsIOino+WOi+WQjuaKiumHjOmdoueahCBiaW4g55uu5b2V5Yqg6L+b57O757ufI
>>"%B64%" echo FBBVEgnICRZZWxsb3cKICAgIFNheSAnICDlt7Loo4Xlpb3lsLHmjInlm57ovabnu6fnu607IOaDs+S7peWQjuWGjeijheWwseebtOaO
>>"%B64%" echo peWFs+aOieacrOeql+WPo+OAgicgJFllbGxvdwogICAgUmVhZC1Ib3N0ICfmjInlm57ovabnu6fnu60nCiAgICAkZmYgPSBHZXQtQ29
>>"%B64%" echo tbWFuZCBmZm1wZWcgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKICAgICRmcCA9IEdldC1Db21tYW5kIGZmcHJvYmUgLUVycm
>>"%B64%" echo 9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKfQppZiAoJGZmIC1hbmQgJGZwKSB7CiAgICAjIOS4iuWPpCBmZm1wZWcgKOavlOWmgiAyM
>>"%B64%" echo DEzIOW5tOeahCkg6IO96LeRLCDkvYbmiYvmnLrmi43nmoQgSEVWQy9ILjI2NSDop4bpopHop6PkuI3liqgsIOaPkOWJjeaPkOmGkgog
>>"%B64%" echo ICAgJHZlciA9ICgmIGZmbXBlZyAtdmVyc2lvbiB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDIpIC1qb2luICcgJwogICAgJG1ham9yID0
>>"%B64%" echo gJG51bGw7ICRidWlsdFllYXIgPSAkbnVsbAogICAgaWYgKCR2ZXIgLW1hdGNoICd2ZXJzaW9uXHMrKFxkKylcLicpIHsgJG1ham9yID
>>"%B64%" echo 0gW2ludF0kTWF0Y2hlc1sxXSB9CiAgICBpZiAoJHZlciAtbWF0Y2ggJ2J1aWx0IG9uIC4qPyhcZHs0fSknKSB7ICRidWlsdFllYXIgP
>>"%B64%" echo SBbaW50XSRNYXRjaGVzWzFdIH0KICAgIGlmICgoJG51bGwgLW5lICRtYWpvciAtYW5kICRtYWpvciAtbHQgNCkgLW9yICgkbnVsbCAt
>>"%B64%" echo ZXEgJG1ham9yIC1hbmQgJG51bGwgLW5lICRidWlsdFllYXIgLWFuZCAkYnVpbHRZZWFyIC1sdCAyMDE5KSkgewogICAgICAgIFNheSA
>>"%B64%" echo iICAhISDmo4DmtYvliLDlvojogIHnmoQgZmZtcGVnOiAkKCR2ZXIuU3Vic3RyaW5nKDAsIFtNYXRoXTo6TWluKDcwLCAkdmVyLkxlbm
>>"%B64%" echo d0aCkpKSIgJFllbGxvdwogICAgICAgIFNheSAnICAgICDluLjop4Top4bpopHog73nlKgsIOS9huaJi+acuuaLjeeahCBIRVZDL0guM
>>"%B64%" echo jY1IOS8muino+S4jeWKqCAo5oq95bin5aSx6LSlKeOAgicgJFllbGxvdwogICAgICAgIFNheSAnICAgICDlu7rorq7mjaLmlrDniYg6
>>"%B64%" echo IHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnICjms6jmhI/orqnmlrDniYjnm5bov4fml6fniYggUEFUSCknICRZZWxsb3cKICAgIH0
>>"%B64%" echo gZWxzZSB7CiAgICAgICAgU2F5ICcgIE9LIGZmbXBlZyDlt7LlsLHkvY0nICRHcmVlbgogICAgfQp9IGVsc2UgewogICAgU2F5ICcgIC
>>"%B64%" echo EhIGZmbXBlZyDku43mnKrmo4DmtYvliLAg4oCU4oCUIOWFiOe7p+e7reijheaPkuS7tiwg6KeG6aKR5Yqf6IO95pqC5LiN5Y+v55So4
>>"%B64%" echo 4CCJyAkWWVsbG93CiAgICBTYXkgJyAgICAg5Lul5ZCO6KOF5aW9IGZmbXBlZyDph43lkK8gZHNoIHdlYiDljbPlj68sIOS4jeeUqOmH
>>"%B64%" echo jei3keacrOWMheOAgicgJFllbGxvdwp9CgojIC0tLS0tLS0tLS0gWzIvNF0g5aSN5Yi25o+S5Lu2IC0tLS0tLS0tLS0KU2F5ICdbMi8
>>"%B64%" echo 0XSDlpI3liLbmj5Lku7YgLi4uJwokcGx1Z2luRGlyID0gSm9pbi1QYXRoICRiYXNlICdkc2gtdmlkZW8tZnJhbWVzJwpOZXctSXRlbS
>>"%B64%" echo AtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRwbHVnaW5EaXIgLUZvcmNlIHwgT3V0LU51bGwKQ29weS1JdGVtIChKb2luLVBhdGggJ
>>"%B64%" echo HNjcmlwdERpciAncGx1Z2luXConKSAkcGx1Z2luRGlyIC1SZWN1cnNlIC1Gb3JjZQpTYXkgJyAgT0sg5bey5aSN5Yi25YiwIEQ6XEFJ
>>"%B64%" echo XEpBUlZJU1xkc2gtdmlkZW8tZnJhbWVzJyAkR3JlZW4KCiMgLS0tLS0tLS0tLSBbMy80XSDlronoo4Xmj5Lku7bkvp3otZYgLS0tLS0
>>"%B64%" echo tLS0tLQojIOaPkuS7tuW/hemhu+iHquW4puS4gOS7vSBub2RlX21vZHVsZXM6IGRzaCDnmoQgcHJvZmlsZSDlj6roo4UgYnVuZGxlIO
>>"%B64%" echo iHqui6qywKIyDkuI3mj5Dkvpvmj5Lku7bopoHnlKjnmoQgQGRlZXBzZWVrLWFpLyog5YyFLCDpnaAgcHJvZmlsZSDmmK/op6PmnpDku
>>"%B64%" echo I3liLDnmoTjgIIKU2F5ICdbMy80XSDlronoo4Xmj5Lku7bkvp3otZYgKOiBlOe9kSwg57qmIDEg5YiG6ZKfKSAuLi4nClB1c2gtTG9j
>>"%B64%" echo YXRpb24gJHBsdWdpbkRpcgpjbWQgL2MgIm5wbSBpbnN0YWxsIC0tbm8tYXVkaXQgLS1uby1mdW5kID5udWwgMj4mMSIKJG5wbU9rID0
>>"%B64%" echo gKCRMQVNURVhJVENPREUgLWVxIDApIC1hbmQgKFRlc3QtUGF0aCAoSm9pbi1QYXRoICRwbHVnaW5EaXIgJ25vZGVfbW9kdWxlcycpKQ
>>"%B64%" echo pQb3AtTG9jYXRpb24KaWYgKCRucG1PaykgewogICAgU2F5ICcgIE9LIOS+nei1luW3suWwseS9jScgJEdyZWVuCn0gZWxzZSB7CiAgI
>>"%B64%" echo CBTYXkgJyAgISEg5L6d6LWW5rKh6KOF5LiKLCDmj5Lku7bkvJrliqDovb3lpLHotKUnICRZZWxsb3cKICAgIFNheSAnICAgICDmiYvl
>>"%B64%" echo iqjph43or5U6IGNkIEQ6XEFJXEpBUlZJU1xkc2gtdmlkZW8tZnJhbWVzICYmIG5wbSBpbnN0YWxsJyAkWWVsbG93Cn0KCiMgLS0tLS0
>>"%B64%" echo tLS0tLSBbNC80XSDoo4Xov5sgRFNIIC0tLS0tLS0tLS0KIyDmnKzmj5Lku7bkuI3pnIDopoHlvoAgcHJvZmlsZSDnmoQgY29yZGlzLn
>>"%B64%" echo BhdGNoLnltbCDlhpnphY3nva4gKOS4jeWDjyBRUSDmoaXopoEgdG9rZW4vY3dkKSwKIyBidW5kbGUgcGF0Y2gg55Sx5o+S5Lu26Ieq5
>>"%B64%" echo bim55qEIGNvcmRpcy5wYXRjaC55bWwg5o+Q5L6b44CCClNheSAnWzQvNF0g5oqK5o+S5Lu26KOF6L+bIERTSCAocHJvZmlsZTogd2Vi
>>"%B64%" echo KSAuLi4nCiRwbHVnaW5EaXJTbGFzaCA9ICRwbHVnaW5EaXIuUmVwbGFjZSgnXCcsICcvJykKY21kIC9jICJkc2ggcGx1Z2luIC0tcHJ
>>"%B64%" echo vZmlsZSB3ZWIgYWRkIGAiJHBsdWdpbkRpclNsYXNoYCIgMj4mMSIKaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsKICAgIFNheSAnIC
>>"%B64%" echo AhISDoo4Xov5sgRFNIIOWksei0pSAo5LiK6Z2i5pyJ5oql6ZSZLCDlj6/lpI3liLbnu5nkvZzogIUpJyAkWWVsbG93Cn0gZWxzZSB7C
>>"%B64%" echo iAgICBTYXkgJyAgT0sg5o+S5Lu25bey6L+bIHdlYiBwcm9maWxlJyAkR3JlZW4KfQoKU2F5ICcnClNheSAnICDoo4XlrozkuoY6JyAk
>>"%B64%" echo R3JlZW4KU2F5ICcgIDEuIOmHjeWQryBkc2ggd2ViOiDlhbPmjonlroPnmoTnqpflj6MsIOWGjeWPjOWHu+ahjOmdoueahCBzdGFydC1
>>"%B64%" echo lbHlzaWEuYmF0JyAkR3JlZW4KU2F5ICcgIDIuIOa1j+iniOWZqOaJk+W8gCBodHRwOi8vMTI3LjAuMC4xOjMwODAsIOebtOaOpeWvue
>>"%B64%" echo eIseiOieivtDonICRHcmVlbgpTYXkgJyAgICAgIuW4ruaIkeeci+S4iyBEOlx2aWRlb3NceHh4Lm1wNCDph4zlj5HnlJ/kuobku4Dku
>>"%B64%" echo YgiJyAkR3JlZW4KU2F5ICcgICAgICLmiorov5nmrrXop4bpopHlgZrmiJAgR0lGIiAvICLov5nkuKrop4bpopHlpJrplb/jgIHku4Dk
>>"%B64%" echo uYjliIbovqjnjociJyAkR3JlZW4KU2F5ICcgIOivpue7huingeWMhemHjOeahCBSRUFETUUubWQnICRHcmVlbgpTYXkgJycKUmVhZC1
>>"%B64%" echo Ib3N0ICfmjInlm57ovablhbPpl60nCg==
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
