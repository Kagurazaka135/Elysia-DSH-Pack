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
>>"%B64%" echo 77u/IyAtKi0gY29kaW5nOiB1dGYtOCAtKi0KIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
>>"%B64%" echo PT09PT09PT09PT0KIyAg5YyFNCDCtyDop4bpopHnkIbop6Mg5LiA6ZSu5a6J6KOFCiMgIOWJjeaPkDog5bey6KOFIOWMhTEgKOaguOW/
>>"%B64%" echo g+WMhSkg5LiUIGRzaCB3ZWIg6IO95q2j5bi46LW3CiMgIOeUqOazlTog5Y+M5Ye7IGluc3RhbGwuYmF0CiMgIOWKn+iDvTog54ix6I6J
>>"%B64%" echo 55yL6KeG6aKRICjlhoXlrrnmgLvnu5Mv5oq95binL+WcuuaZr+ajgOa1iy9HSUYv5YWD5pWw5o2uKQojICDkvp3otZY6IGZmbXBlZyAr
>>"%B64%" echo IGZmcHJvYmUg5b+F6aG75Zyo57O757ufIFBBVEggKOiEmuacrOajgOafpeW5tue7meaMh+W8lSwg5LiN6Ieq5Yqo6KOFKQojID09PT09
>>"%B64%" echo PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQokRXJyb3JBY3Rpb25QcmVmZXJlbmNl
>>"%B64%" echo ID0gJ1N0b3AnCiRDeWFuID0gJ0N5YW4nOyAkR3JlZW4gPSAnR3JlZW4nOyAkWWVsbG93ID0gJ1llbGxvdyc7ICRQaW5rID0gJ01hZ2Vu
>>"%B64%" echo dGEnCmZ1bmN0aW9uIFNheSgkbSwgJGMgPSAkQ3lhbikgeyBXcml0ZS1Ib3N0ICIgICRtIiAtRm9yZWdyb3VuZENvbG9yICRjIH0KClNh
>>"%B64%" echo eSAn4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ
>>"%B64%" echo 4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQJyAkUGluawpTYXkgJyAg54ix6I6J6KeG6aKR55CG6KejIMK3IOS4
>>"%B64%" echo gOmUruWuieijhScgJFBpbmsKU2F5ICfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAnICRQaW5rClNheSAnJwoKJGJh
>>"%B64%" echo c2UgPSAnRDpcQUlcSkFSVklTJwokc2NyaXB0RGlyID0gKCRhcmdzWzBdIC1yZXBsYWNlICciJywgJycpLlRyaW1FbmQoJ1wnKQpOZXct
>>"%B64%" echo SXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRiYXNlIC1Gb3JjZSB8IE91dC1OdWxsCgojIC0tLS0tLS0tLS0gWzEvNF0g546v
>>"%B64%" echo 5aKD5qOA5p+lIC0tLS0tLS0tLS0KU2F5ICdbMS80XSDmo4Dmn6Xnjq/looMgLi4uJwppZiAoLW5vdCAoR2V0LUNvbW1hbmQgZHNoIC1F
>>"%B64%" echo cnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKSkgewogICAgU2F5ICcgIOacquajgOa1i+WIsCBEU0gsIOivt+WFiOWuieijhSDljIUx
>>"%B64%" echo ICjmoLjlv4PljIUpIScgJFllbGxvdwogICAgUmVhZC1Ib3N0ICfmjInlm57ovabpgIDlh7onOyBleGl0IDEKfQojIGRzaCDnmoTmj5Lk
>>"%B64%" echo u7bnrqHnkIblhoXpg6jovazlj5Hnu5kgcG5wbSwg5rKh5pyJIHBucG0g5Lya55u05o6l5aSx6LSlIChleGl0IDEyNykKaWYgKC1ub3Qg
>>"%B64%" echo KEdldC1Db21tYW5kIHBucG0gLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUpKSB7CiAgICBTYXkgJyAg5pyq5qOA5rWL5YiwIHBu
>>"%B64%" echo cG0sIOato+WcqOWuieijhSAuLi4nICRZZWxsb3cKICAgIGNtZCAvYyAibnBtIGluc3RhbGwgLWcgcG5wbSA+bnVsIDI+JjEiCiAgICBp
>>"%B64%" echo ZiAoLW5vdCAoR2V0LUNvbW1hbmQgcG5wbSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSkpIHsKICAgICAgICBTYXkgJyAgISEg
>>"%B64%" echo cG5wbSDoo4XkuI3kuIosIOivt+aJi+WKqOaJp+ihjDogbnBtIGluc3RhbGwgLWcgcG5wbScgJFllbGxvdwogICAgICAgIFJlYWQtSG9z
>>"%B64%" echo dCAn5oyJ5Zue6L2m6YCA5Ye6JzsgZXhpdCAxCiAgICB9Cn0KU2F5ICcgIE9LIGRzaCArIHBucG0g6YO95ZyoJyAkR3JlZW4KCiMgZmZt
>>"%B64%" echo cGVnIC8gZmZwcm9iZSDmmK/op4bpopHlip/og73nmoTlkb3moLnlrZA6IOayoeacieWug+aPkuS7tueFp+agt+WKoOi9vSwg5L2G5bel
>>"%B64%" echo 5YW35LiA6LCD5bCx5oql6ZSZ44CCCiMg5Y+q5o+Q56S65LiN6Ieq5Yqo6KOFIOKAlOKAlCBmZm1wZWcg5L2T56ev5aSn44CB6KOF5rOV
>>"%B64%" echo 5aSa44CB6Ieq5Yqo6KOF5a655piT57+76L2mLCDorqnnlKjmiLfmiYvliqjjgIIKJGZmID0gR2V0LUNvbW1hbmQgZmZtcGVnIC1FcnJv
>>"%B64%" echo ckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlCiRmcCA9IEdldC1Db21tYW5kIGZmcHJvYmUgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGlu
>>"%B64%" echo dWUKaWYgKC1ub3QgJGZmIC1vciAtbm90ICRmcCkgewogICAgU2F5ICcnICRZZWxsb3cKICAgIFNheSAnICDmnKrmo4DmtYvliLAgZmZt
>>"%B64%" echo cGVnIC8gZmZwcm9iZSDigJTigJQg6KeG6aKR5Yqf6IO95b+F6aG75L6d6LWW5a6DIScgJFllbGxvdwogICAgU2F5ICcgIOayoeacieea
>>"%B64%" echo hOivnTog5o+S5Lu26IO96KOF5LiKLCDkvYbmir3luKcvR0lGL+aAu+e7k+exu+W3peWFt+S4gOeUqOWwseaKpemUmeOAgicgJFllbGxv
>>"%B64%" echo dwogICAgU2F5ICcgIOivt+aJi+WKqOWuieijhSAo5LqM6YCJ5LiAKTonICRZZWxsb3cKICAgIFNheSAnICAgIDEuIOaWsOW8gOS4gOS4
>>"%B64%" echo quWRveS7pOihjOeql+WPo+aJp+ihjDogIHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnJyAkWWVsbG93CiAgICBTYXkgJyAgICAgICDo
>>"%B64%" echo o4XlrozopoHph43lvIDnqpflj6MgKOiuqSBQQVRIIOeUn+aViCknICRZZWxsb3cKICAgIFNheSAnICAgIDIuIOaIluWIsCBodHRwczov
>>"%B64%" echo L3d3dy5neWFuLmRldi9mZm1wZWcvYnVpbGRzLyDkuIvovb0nICRZZWxsb3cKICAgIFNheSAnICAgICAgIHJlbGVhc2UtZXNzZW50aWFs
>>"%B64%" echo cy56aXAsIOino+WOi+WQjuaKiumHjOmdoueahCBiaW4g55uu5b2V5Yqg6L+b57O757ufIFBBVEgnICRZZWxsb3cKICAgIFNheSAnICDl
>>"%B64%" echo t7Loo4Xlpb3lsLHmjInlm57ovabnu6fnu607IOaDs+S7peWQjuWGjeijheWwseebtOaOpeWFs+aOieacrOeql+WPo+OAgicgJFllbGxv
>>"%B64%" echo dwogICAgUmVhZC1Ib3N0ICfmjInlm57ovabnu6fnu60nCiAgICAkZmYgPSBHZXQtQ29tbWFuZCBmZm1wZWcgLUVycm9yQWN0aW9uIFNp
>>"%B64%" echo bGVudGx5Q29udGludWUKICAgICRmcCA9IEdldC1Db21tYW5kIGZmcHJvYmUgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKfQpp
>>"%B64%" echo ZiAoJGZmIC1hbmQgJGZwKSB7CiAgICAjIOS4iuWPpCBmZm1wZWcgKOavlOWmgiAyMDEzIOW5tOeahCkg6IO96LeRLCDkvYbmiYvmnLrm
>>"%B64%" echo i43nmoQgSEVWQy9ILjI2NSDop4bpopHop6PkuI3liqgsIOaPkOWJjeaPkOmGkgogICAgJHZlciA9ICgmIGZmbXBlZyAtdmVyc2lvbiB8
>>"%B64%" echo IFNlbGVjdC1PYmplY3QgLUZpcnN0IDIpIC1qb2luICcgJwogICAgJG1ham9yID0gJG51bGw7ICRidWlsdFllYXIgPSAkbnVsbAogICAg
>>"%B64%" echo aWYgKCR2ZXIgLW1hdGNoICd2ZXJzaW9uXHMrKFxkKylcLicpIHsgJG1ham9yID0gW2ludF0kTWF0Y2hlc1sxXSB9CiAgICBpZiAoJHZl
>>"%B64%" echo ciAtbWF0Y2ggJ2J1aWx0IG9uIC4qPyhcZHs0fSknKSB7ICRidWlsdFllYXIgPSBbaW50XSRNYXRjaGVzWzFdIH0KICAgIGlmICgoJG51
>>"%B64%" echo bGwgLW5lICRtYWpvciAtYW5kICRtYWpvciAtbHQgNCkgLW9yICgkbnVsbCAtZXEgJG1ham9yIC1hbmQgJG51bGwgLW5lICRidWlsdFll
>>"%B64%" echo YXIgLWFuZCAkYnVpbHRZZWFyIC1sdCAyMDE5KSkgewogICAgICAgIFNheSAiICAhISDmo4DmtYvliLDlvojogIHnmoQgZmZtcGVnOiAk
>>"%B64%" echo KCR2ZXIuU3Vic3RyaW5nKDAsIFtNYXRoXTo6TWluKDcwLCAkdmVyLkxlbmd0aCkpKSIgJFllbGxvdwogICAgICAgIFNheSAnICAgICDl
>>"%B64%" echo uLjop4Top4bpopHog73nlKgsIOS9huaJi+acuuaLjeeahCBIRVZDL0guMjY1IOS8muino+S4jeWKqCAo5oq95bin5aSx6LSlKeOAgicg
>>"%B64%" echo JFllbGxvdwogICAgICAgIFNheSAnICAgICDlu7rorq7mjaLmlrDniYg6IHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnICjms6jmhI/o
>>"%B64%" echo rqnmlrDniYjnm5bov4fml6fniYggUEFUSCknICRZZWxsb3cKICAgIH0gZWxzZSB7CiAgICAgICAgU2F5ICcgIE9LIGZmbXBlZyDlt7Ll
>>"%B64%" echo sLHkvY0nICRHcmVlbgogICAgfQp9IGVsc2UgewogICAgU2F5ICcgICEhIGZmbXBlZyDku43mnKrmo4DmtYvliLAg4oCU4oCUIOWFiOe7
>>"%B64%" echo p+e7reijheaPkuS7tiwg6KeG6aKR5Yqf6IO95pqC5LiN5Y+v55So44CCJyAkWWVsbG93CiAgICBTYXkgJyAgICAg5Lul5ZCO6KOF5aW9
>>"%B64%" echo IGZmbXBlZyDph43lkK8gZHNoIHdlYiDljbPlj68sIOS4jeeUqOmHjei3keacrOWMheOAgicgJFllbGxvdwp9CgojIC0tLS0tLS0tLS0g
>>"%B64%" echo WzIvNF0g5aSN5Yi25o+S5Lu2IC0tLS0tLS0tLS0KU2F5ICdbMi80XSDlpI3liLbmj5Lku7YgLi4uJwokcGx1Z2luRGlyID0gSm9pbi1Q
>>"%B64%" echo YXRoICRiYXNlICdkc2gtdmlkZW8tZnJhbWVzJwpOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRwbHVnaW5EaXIgLUZv
>>"%B64%" echo cmNlIHwgT3V0LU51bGwKQ29weS1JdGVtIChKb2luLVBhdGggJHNjcmlwdERpciAncGx1Z2luXConKSAkcGx1Z2luRGlyIC1SZWN1cnNl
>>"%B64%" echo IC1Gb3JjZQpTYXkgJyAgT0sg5bey5aSN5Yi25YiwIEQ6XEFJXEpBUlZJU1xkc2gtdmlkZW8tZnJhbWVzJyAkR3JlZW4KCiMgLS0tLS0t
>>"%B64%" echo LS0tLSBbMy80XSDlronoo4Xmj5Lku7bkvp3otZYgLS0tLS0tLS0tLQojIOaPkuS7tuW/hemhu+iHquW4puS4gOS7vSBub2RlX21vZHVs
>>"%B64%" echo ZXM6IGRzaCDnmoQgcHJvZmlsZSDlj6roo4UgYnVuZGxlIOiHqui6qywKIyDkuI3mj5Dkvpvmj5Lku7bopoHnlKjnmoQgQGRlZXBzZWVr
>>"%B64%" echo LWFpLyog5YyFLCDpnaAgcHJvZmlsZSDmmK/op6PmnpDkuI3liLDnmoTjgIIKU2F5ICdbMy80XSDlronoo4Xmj5Lku7bkvp3otZYgKOiB
>>"%B64%" echo lOe9kSwg57qmIDEg5YiG6ZKfKSAuLi4nClB1c2gtTG9jYXRpb24gJHBsdWdpbkRpcgpjbWQgL2MgIm5wbSBpbnN0YWxsIC0tbm8tYXVk
>>"%B64%" echo aXQgLS1uby1mdW5kID5udWwgMj4mMSIKJG5wbU9rID0gKCRMQVNURVhJVENPREUgLWVxIDApIC1hbmQgKFRlc3QtUGF0aCAoSm9pbi1Q
>>"%B64%" echo YXRoICRwbHVnaW5EaXIgJ25vZGVfbW9kdWxlcycpKQpQb3AtTG9jYXRpb24KaWYgKCRucG1PaykgewogICAgU2F5ICcgIE9LIOS+nei1
>>"%B64%" echo luW3suWwseS9jScgJEdyZWVuCn0gZWxzZSB7CiAgICBTYXkgJyAgISEg5L6d6LWW5rKh6KOF5LiKLCDmj5Lku7bkvJrliqDovb3lpLHo
>>"%B64%" echo tKUnICRZZWxsb3cKICAgIFNheSAnICAgICDmiYvliqjph43or5U6IGNkIEQ6XEFJXEpBUlZJU1xkc2gtdmlkZW8tZnJhbWVzICYmIG5w
>>"%B64%" echo bSBpbnN0YWxsJyAkWWVsbG93Cn0KCiMgLS0tLS0tLS0tLSBbNC80XSDoo4Xov5sgRFNIIC0tLS0tLS0tLS0KIyDmnKzmj5Lku7bkuI3p
>>"%B64%" echo nIDopoHlvoAgcHJvZmlsZSDnmoQgY29yZGlzLnBhdGNoLnltbCDlhpnphY3nva4gKOS4jeWDjyBRUSDmoaXopoEgdG9rZW4vY3dkKSwK
>>"%B64%" echo IyBidW5kbGUgcGF0Y2gg55Sx5o+S5Lu26Ieq5bim55qEIGNvcmRpcy5wYXRjaC55bWwg5o+Q5L6b44CCClNheSAnWzQvNF0g5oqK5o+S
>>"%B64%" echo 5Lu26KOF6L+bIERTSCAocHJvZmlsZTogd2ViKSAuLi4nCiRwbHVnaW5EaXJTbGFzaCA9ICRwbHVnaW5EaXIuUmVwbGFjZSgnXCcsICcv
>>"%B64%" echo JykKY21kIC9jICJkc2ggcGx1Z2luIC0tcHJvZmlsZSB3ZWIgYWRkIGAiJHBsdWdpbkRpclNsYXNoYCIgMj4mMSIKaWYgKCRMQVNURVhJ
>>"%B64%" echo VENPREUgLW5lIDApIHsKICAgIFNheSAnICAhISDoo4Xov5sgRFNIIOWksei0pSAo5LiK6Z2i5pyJ5oql6ZSZLCDlj6/lpI3liLbnu5nk
>>"%B64%" echo vZzogIUpJyAkWWVsbG93Cn0gZWxzZSB7CiAgICBTYXkgJyAgT0sg5o+S5Lu25bey6L+bIHdlYiBwcm9maWxlJyAkR3JlZW4KfQoKU2F5
>>"%B64%" echo ICcnClNheSAnICDoo4XlrozkuoY6JyAkR3JlZW4KU2F5ICcgIDEuIOmHjeWQryBkc2ggd2ViOiDlhbPmjonlroPnmoTnqpflj6MsIOWG
>>"%B64%" echo jeWPjOWHu+ahjOmdoueahCBzdGFydC1lbHlzaWEuYmF0JyAkR3JlZW4KU2F5ICcgIDIuIOa1j+iniOWZqOaJk+W8gCBodHRwOi8vMTI3
>>"%B64%" echo LjAuMC4xOjMwODAsIOebtOaOpeWvueeIseiOieivtDonICRHcmVlbgpTYXkgJyAgICAgIuW4ruaIkeeci+S4iyBEOlx2aWRlb3NceHh4
>>"%B64%" echo Lm1wNCDph4zlj5HnlJ/kuobku4DkuYgiJyAkR3JlZW4KU2F5ICcgICAgICLmiorov5nmrrXop4bpopHlgZrmiJAgR0lGIiAvICLov5nk
>>"%B64%" echo uKrop4bpopHlpJrplb/jgIHku4DkuYjliIbovqjnjociJyAkR3JlZW4KU2F5ICcgIOivpue7huingeWMhemHjOeahCBSRUFETUUubWQn
>>"%B64%" echo ICRHcmVlbgpTYXkgJycKUmVhZC1Ib3N0ICfmjInlm57ovablhbPpl60nCg==
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
