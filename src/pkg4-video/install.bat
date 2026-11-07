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
>>"%B64%" echo 77u/IyAtKi0gY29kaW5nOiB1dGYtOCAtKi0KIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
>>"%B64%" echo PT09PT09PT09PT09PT0KIyAg5YyFNCDCtyDop4bpopHnkIbop6Mg5LiA6ZSu5a6J6KOFCiMgIOWJjeaPkDog5bey6KOFIOWMhTEg
>>"%B64%" echo KOaguOW/g+WMhSkg5LiUIGRzaCB3ZWIg6IO95q2j5bi46LW3CiMgIOeUqOazlTog5Y+M5Ye7IGluc3RhbGwuYmF0CiMgIOWKn+iD
>>"%B64%" echo vTog54ix6I6J55yL6KeG6aKRICjlhoXlrrnmgLvnu5Mv5oq95binL+WcuuaZr+ajgOa1iy9HSUYv5YWD5pWw5o2uKQojICDkvp3o
>>"%B64%" echo tZY6IGZmbXBlZyArIGZmcHJvYmUg5b+F6aG75Zyo57O757ufIFBBVEggKOiEmuacrOajgOafpeW5tue7meaMh+W8lSwg5LiN6Ieq
>>"%B64%" echo 5Yqo6KOFKQojID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQokRXJy
>>"%B64%" echo b3JBY3Rpb25QcmVmZXJlbmNlID0gJ1N0b3AnCiRDeWFuID0gJ0N5YW4nOyAkR3JlZW4gPSAnR3JlZW4nOyAkWWVsbG93ID0gJ1ll
>>"%B64%" echo bGxvdyc7ICRQaW5rID0gJ01hZ2VudGEnCmZ1bmN0aW9uIFNheSgkbSwgJGMgPSAkQ3lhbikgeyBXcml0ZS1Ib3N0ICIgICRtIiAt
>>"%B64%" echo Rm9yZWdyb3VuZENvbG9yICRjIH0KClNheSAn4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ
>>"%B64%" echo 4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQJyAkUGluawpT
>>"%B64%" echo YXkgJyAg54ix6I6J6KeG6aKR55CG6KejIMK3IOS4gOmUruWuieijhScgJFBpbmsKU2F5ICfilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZAnICRQaW5rClNheSAnJwoKJGJhc2UgPSAnRDpcQUlcSkFSVklTJwokc2NyaXB0RGlyID0gKCRhcmdz
>>"%B64%" echo WzBdIC1yZXBsYWNlICciJywgJycpLlRyaW1FbmQoJ1wnKQpOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRiYXNl
>>"%B64%" echo IC1Gb3JjZSB8IE91dC1OdWxsCgojIC0tLS0tLS0tLS0gWzEvNF0g546v5aKD5qOA5p+lIC0tLS0tLS0tLS0KU2F5ICdbMS80XSDm
>>"%B64%" echo o4Dmn6Xnjq/looMgLi4uJwppZiAoLW5vdCAoR2V0LUNvbW1hbmQgZHNoIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKSkg
>>"%B64%" echo ewogICAgU2F5ICcgIOacquajgOa1i+WIsCBEU0gsIOivt+WFiOWuieijhSDljIUxICjmoLjlv4PljIUpIScgJFllbGxvdwogICAg
>>"%B64%" echo UmVhZC1Ib3N0ICfmjInlm57ovabpgIDlh7onOyBleGl0IDEKfQojIGRzaCDnmoTmj5Lku7bnrqHnkIblhoXpg6jovazlj5Hnu5kg
>>"%B64%" echo cG5wbSwg5rKh5pyJIHBucG0g5Lya55u05o6l5aSx6LSlIChleGl0IDEyNykKaWYgKC1ub3QgKEdldC1Db21tYW5kIHBucG0gLUVy
>>"%B64%" echo cm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUpKSB7CiAgICBTYXkgJyAg5pyq5qOA5rWL5YiwIHBucG0sIOato+WcqOWuieijhSAu
>>"%B64%" echo Li4nICRZZWxsb3cKICAgIGNtZCAvYyAibnBtIGluc3RhbGwgLWcgcG5wbSA+bnVsIDI+JjEiCiAgICBpZiAoLW5vdCAoR2V0LUNv
>>"%B64%" echo bW1hbmQgcG5wbSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSkpIHsKICAgICAgICBTYXkgJyAgISEgcG5wbSDoo4XkuI3k
>>"%B64%" echo uIosIOivt+aJi+WKqOaJp+ihjDogbnBtIGluc3RhbGwgLWcgcG5wbScgJFllbGxvdwogICAgICAgIFJlYWQtSG9zdCAn5oyJ5Zue
>>"%B64%" echo 6L2m6YCA5Ye6JzsgZXhpdCAxCiAgICB9Cn0KU2F5ICcgIE9LIGRzaCArIHBucG0g6YO95ZyoJyAkR3JlZW4KCiMgZmZtcGVnIC8g
>>"%B64%" echo ZmZwcm9iZSDmmK/op4bpopHlip/og73nmoTlkb3moLnlrZA6IOayoeacieWug+aPkuS7tueFp+agt+WKoOi9vSwg5L2G5bel5YW3
>>"%B64%" echo 5LiA6LCD5bCx5oql6ZSZ44CCCiMg5Y+q5o+Q56S65LiN6Ieq5Yqo6KOFIOKAlOKAlCBmZm1wZWcg5L2T56ev5aSn44CB6KOF5rOV
>>"%B64%" echo 5aSa44CB6Ieq5Yqo6KOF5a655piT57+76L2mLCDorqnnlKjmiLfmiYvliqjjgIIKJGZmID0gR2V0LUNvbW1hbmQgZmZtcGVnIC1F
>>"%B64%" echo cnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlCiRmcCA9IEdldC1Db21tYW5kIGZmcHJvYmUgLUVycm9yQWN0aW9uIFNpbGVudGx5
>>"%B64%" echo Q29udGludWUKaWYgKC1ub3QgJGZmIC1vciAtbm90ICRmcCkgewogICAgU2F5ICcnICRZZWxsb3cKICAgIFNheSAnICDmnKrmo4Dm
>>"%B64%" echo tYvliLAgZmZtcGVnIC8gZmZwcm9iZSDigJTigJQg6KeG6aKR5Yqf6IO95b+F6aG75L6d6LWW5a6DIScgJFllbGxvdwogICAgU2F5
>>"%B64%" echo ICcgIOayoeacieeahOivnTog5o+S5Lu26IO96KOF5LiKLCDkvYbmir3luKcvR0lGL+aAu+e7k+exu+W3peWFt+S4gOeUqOWwseaK
>>"%B64%" echo pemUmeOAgicgJFllbGxvdwogICAgU2F5ICcgIOivt+aJi+WKqOWuieijhSAo5LqM6YCJ5LiAKTonICRZZWxsb3cKICAgIFNheSAn
>>"%B64%" echo ICAgIDEuIOaWsOW8gOS4gOS4quWRveS7pOihjOeql+WPo+aJp+ihjDogIHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnJyAkWWVs
>>"%B64%" echo bG93CiAgICBTYXkgJyAgICAgICDoo4XlrozopoHph43lvIDnqpflj6MgKOiuqSBQQVRIIOeUn+aViCknICRZZWxsb3cKICAgIFNh
>>"%B64%" echo eSAnICAgIDIuIOaIluWIsCBodHRwczovL3d3dy5neWFuLmRldi9mZm1wZWcvYnVpbGRzLyDkuIvovb0nICRZZWxsb3cKICAgIFNh
>>"%B64%" echo eSAnICAgICAgIHJlbGVhc2UtZXNzZW50aWFscy56aXAsIOino+WOi+WQjuaKiumHjOmdoueahCBiaW4g55uu5b2V5Yqg6L+b57O7
>>"%B64%" echo 57ufIFBBVEgnICRZZWxsb3cKICAgIFNheSAnICDlt7Loo4Xlpb3lsLHmjInlm57ovabnu6fnu607IOaDs+S7peWQjuWGjeijheWw
>>"%B64%" echo seebtOaOpeWFs+aOieacrOeql+WPo+OAgicgJFllbGxvdwogICAgUmVhZC1Ib3N0ICfmjInlm57ovabnu6fnu60nCiAgICAkZmYg
>>"%B64%" echo PSBHZXQtQ29tbWFuZCBmZm1wZWcgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKICAgICRmcCA9IEdldC1Db21tYW5kIGZm
>>"%B64%" echo cHJvYmUgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKfQppZiAoJGZmIC1hbmQgJGZwKSB7CiAgICAjIOS4iuWPpCBmZm1w
>>"%B64%" echo ZWcgKOavlOWmgiAyMDEzIOW5tOeahCkg6IO96LeRLCDkvYbmiYvmnLrmi43nmoQgSEVWQy9ILjI2NSDop4bpopHop6PkuI3liqgs
>>"%B64%" echo IOaPkOWJjeaPkOmGkgogICAgJHZlciA9ICgmIGZmbXBlZyAtdmVyc2lvbiB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDIpIC1qb2lu
>>"%B64%" echo ICcgJwogICAgJG1ham9yID0gJG51bGw7ICRidWlsdFllYXIgPSAkbnVsbAogICAgaWYgKCR2ZXIgLW1hdGNoICd2ZXJzaW9uXHMr
>>"%B64%" echo KFxkKylcLicpIHsgJG1ham9yID0gW2ludF0kTWF0Y2hlc1sxXSB9CiAgICBpZiAoJHZlciAtbWF0Y2ggJ2J1aWx0IG9uIC4qPyhc
>>"%B64%" echo ZHs0fSknKSB7ICRidWlsdFllYXIgPSBbaW50XSRNYXRjaGVzWzFdIH0KICAgIGlmICgoJG51bGwgLW5lICRtYWpvciAtYW5kICRt
>>"%B64%" echo YWpvciAtbHQgNCkgLW9yICgkbnVsbCAtZXEgJG1ham9yIC1hbmQgJG51bGwgLW5lICRidWlsdFllYXIgLWFuZCAkYnVpbHRZZWFy
>>"%B64%" echo IC1sdCAyMDE5KSkgewogICAgICAgIFNheSAiICAhISDmo4DmtYvliLDlvojogIHnmoQgZmZtcGVnOiAkKCR2ZXIuU3Vic3RyaW5n
>>"%B64%" echo KDAsIFtNYXRoXTo6TWluKDcwLCAkdmVyLkxlbmd0aCkpKSIgJFllbGxvdwogICAgICAgIFNheSAnICAgICDluLjop4Top4bpopHo
>>"%B64%" echo g73nlKgsIOS9huaJi+acuuaLjeeahCBIRVZDL0guMjY1IOS8muino+S4jeWKqCAo5oq95bin5aSx6LSlKeOAgicgJFllbGxvdwog
>>"%B64%" echo ICAgICAgIFNheSAnICAgICDlu7rorq7mjaLmlrDniYg6IHdpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnICjms6jmhI/orqnmlrDn
>>"%B64%" echo iYjnm5bov4fml6fniYggUEFUSCknICRZZWxsb3cKICAgIH0gZWxzZSB7CiAgICAgICAgU2F5ICcgIE9LIGZmbXBlZyDlt7LlsLHk
>>"%B64%" echo vY0nICRHcmVlbgogICAgfQp9IGVsc2UgewogICAgU2F5ICcgICEhIGZmbXBlZyDku43mnKrmo4DmtYvliLAg4oCU4oCUIOWFiOe7
>>"%B64%" echo p+e7reijheaPkuS7tiwg6KeG6aKR5Yqf6IO95pqC5LiN5Y+v55So44CCJyAkWWVsbG93CiAgICBTYXkgJyAgICAg5Lul5ZCO6KOF
>>"%B64%" echo 5aW9IGZmbXBlZyDph43lkK8gZHNoIHdlYiDljbPlj68sIOS4jeeUqOmHjei3keacrOWMheOAgicgJFllbGxvdwp9CgojIC0tLS0t
>>"%B64%" echo LS0tLS0gWzIvNF0g5aSN5Yi25o+S5Lu2IC0tLS0tLS0tLS0KU2F5ICdbMi80XSDlpI3liLbmj5Lku7YgLi4uJwokcGx1Z2luRGly
>>"%B64%" echo ID0gSm9pbi1QYXRoICRiYXNlICdkc2gtdmlkZW8tZnJhbWVzJwpOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRw
>>"%B64%" echo bHVnaW5EaXIgLUZvcmNlIHwgT3V0LU51bGwKQ29weS1JdGVtIChKb2luLVBhdGggJHNjcmlwdERpciAnbW9kc1x2aWRlb1xwbHVn
>>"%B64%" echo aW5cKicpICRwbHVnaW5EaXIgLVJlY3Vyc2UgLUZvcmNlClNheSAnICBPSyDlt7LlpI3liLbliLAgRDpcQUlcSkFSVklTXGRzaC12
>>"%B64%" echo aWRlby1mcmFtZXMnICRHcmVlbgoKIyAtLS0tLS0tLS0tIFszLzRdIOWuieijheaPkuS7tuS+nei1liAtLS0tLS0tLS0tCiMg5o+S
>>"%B64%" echo 5Lu25b+F6aG76Ieq5bim5LiA5Lu9IG5vZGVfbW9kdWxlczogZHNoIOeahCBwcm9maWxlIOWPquijhSBidW5kbGUg6Ieq6LqrLAoj
>>"%B64%" echo IOS4jeaPkOS+m+aPkuS7tuimgeeUqOeahCBAZGVlcHNlZWstYWkvKiDljIUsIOmdoCBwcm9maWxlIOaYr+ino+aekOS4jeWIsOea
>>"%B64%" echo hOOAggpTYXkgJ1szLzRdIOWuieijheaPkuS7tuS+nei1liAo6IGU572RLCDnuqYgMSDliIbpkp8pIC4uLicKUHVzaC1Mb2NhdGlv
>>"%B64%" echo biAkcGx1Z2luRGlyCmNtZCAvYyAibnBtIGluc3RhbGwgLS1uby1hdWRpdCAtLW5vLWZ1bmQgPm51bCAyPiYxIgokbnBtT2sgPSAo
>>"%B64%" echo JExBU1RFWElUQ09ERSAtZXEgMCkgLWFuZCAoVGVzdC1QYXRoIChKb2luLVBhdGggJHBsdWdpbkRpciAnbm9kZV9tb2R1bGVzJykp
>>"%B64%" echo ClBvcC1Mb2NhdGlvbgppZiAoJG5wbU9rKSB7CiAgICBTYXkgJyAgT0sg5L6d6LWW5bey5bCx5L2NJyAkR3JlZW4KfSBlbHNlIHsK
>>"%B64%" echo ICAgIFNheSAnICAhISDkvp3otZbmsqHoo4XkuIosIOaPkuS7tuS8muWKoOi9veWksei0pScgJFllbGxvdwogICAgU2F5ICcgICAg
>>"%B64%" echo IOaJi+WKqOmHjeivlTogY2QgRDpcQUlcSkFSVklTXGRzaC12aWRlby1mcmFtZXMgJiYgbnBtIGluc3RhbGwnICRZZWxsb3cKfQoK
>>"%B64%" echo IyAtLS0tLS0tLS0tIFs0LzRdIOijhei/myBEU0ggLS0tLS0tLS0tLQojIOacrOaPkuS7tuS4jemcgOimgeW+gCBwcm9maWxlIOea
>>"%B64%" echo hCBjb3JkaXMucGF0Y2gueW1sIOWGmemFjee9riAo5LiN5YOPIFFRIOahpeimgSB0b2tlbi9jd2QpLAojIGJ1bmRsZSBwYXRjaCDn
>>"%B64%" echo lLHmj5Lku7boh6rluKbnmoQgY29yZGlzLnBhdGNoLnltbCDmj5DkvpvjgIIKU2F5ICdbNC80XSDmiormj5Lku7boo4Xov5sgRFNI
>>"%B64%" echo IChwcm9maWxlOiB3ZWIpIC4uLicKJHBsdWdpbkRpclNsYXNoID0gJHBsdWdpbkRpci5SZXBsYWNlKCdcJywgJy8nKQpjbWQgL2Mg
>>"%B64%" echo ImRzaCBwbHVnaW4gLS1wcm9maWxlIHdlYiBhZGQgYCIkcGx1Z2luRGlyU2xhc2hgIiAyPiYxIgppZiAoJExBU1RFWElUQ09ERSAt
>>"%B64%" echo bmUgMCkgewogICAgU2F5ICcgICEhIOijhei/myBEU0gg5aSx6LSlICjkuIrpnaLmnInmiqXplJksIOWPr+WkjeWItue7meS9nOiA
>>"%B64%" echo hSknICRZZWxsb3cKfSBlbHNlIHsKICAgIFNheSAnICBPSyDmj5Lku7blt7Lov5sgd2ViIHByb2ZpbGUnICRHcmVlbgp9CgpTYXkg
>>"%B64%" echo JycKU2F5ICcgIOijheWujOS6hjonICRHcmVlbgpTYXkgJyAgMS4g6YeN5ZCvIGRzaCB3ZWI6IOWFs+aOieWug+eahOeql+WPoywg
>>"%B64%" echo 5YaN5Y+M5Ye75qGM6Z2i55qEIHN0YXJ0LWVseXNpYS5iYXQnICRHcmVlbgpTYXkgJyAgMi4g5rWP6KeI5Zmo5omT5byAIGh0dHA6
>>"%B64%" echo Ly8xMjcuMC4wLjE6MzA4MCwg55u05o6l5a+554ix6I6J6K+0OicgJEdyZWVuClNheSAnICAgICAi5biu5oiR55yL5LiLIEQ6XHZp
>>"%B64%" echo ZGVvc1x4eHgubXA0IOmHjOWPkeeUn+S6huS7gOS5iCInICRHcmVlbgpTYXkgJyAgICAgIuaKiui/meauteinhumikeWBmuaIkCBH
>>"%B64%" echo SUYiIC8gIui/meS4quinhumikeWkmumVv+OAgeS7gOS5iOWIhui+qOeOhyInICRHcmVlbgpTYXkgJyAg6K+m57uG6KeB5YyF6YeM
>>"%B64%" echo 55qEIFJFQURNRS5tZCcgJEdyZWVuClNheSAnJwpSZWFkLUhvc3QgJ+aMieWbnui9puWFs+mXrScK
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
