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
>>"%B64%" echo PT09PT09PT09PT09PT0KIyAg5YyFMiDCtyDniLHojonkurrmoLwgKyDor63pn7Mg5LiA6ZSu5a6J6KOFCiMgIOWJjeaPkDog5bey
>>"%B64%" echo 6KOFIOWMhTEgKERlZXBTZWVrIEhhcm5lc3MpCiMgIOeUqOazlTog5Y+M5Ye7IGluc3RhbGwuYmF0IC0+IOiHquWKqOWujOaIkAoj
>>"%B64%" echo ICDljIXlkKs6IOeIseiOieS6uuagvOmihOiuviArIOesrOS4gOeJiOWjsOe6vyAoQ29zeVZvaWNlKQojID09PT09PT09PT09PT09
>>"%B64%" echo PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQokRXJyb3JBY3Rpb25QcmVmZXJlbmNlID0gJ1N0
>>"%B64%" echo b3AnCiRDeWFuID0gJ0N5YW4nOyAkR3JlZW4gPSAnR3JlZW4nOyAkWWVsbG93ID0gJ1llbGxvdyc7ICRQaW5rID0gJ01hZ2VudGEn
>>"%B64%" echo CmZ1bmN0aW9uIFNheSgkbSwgJGMgPSAkQ3lhbikgeyBXcml0ZS1Ib3N0ICIgICRtIiAtRm9yZWdyb3VuZENvbG9yICRjIH0KClNh
>>"%B64%" echo eSAn4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ
>>"%B64%" echo 4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQJyAkUGluawpTYXkgJyAg54ix6I6J5biM6ZuFIMK3IOS6
>>"%B64%" echo uuagvOS4juivremfs+WuieijhScgJFBpbmsKU2F5ICfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAnICRQ
>>"%B64%" echo aW5rClNheSAnJwoKJGRzaEhvbWUgPSBKb2luLVBhdGggJGVudjpVU0VSUFJPRklMRSAnLmRzaCcKJHNjcmlwdERpciA9ICRhcmdz
>>"%B64%" echo WzBdLlRyaW1FbmQoJ1wnKQoKIyAxLiDmo4Dmn6UgRFNIClNheSAnWzEvM10g5qOA5p+lIERlZXBTZWVrIEhhcm5lc3MgLi4uJwok
>>"%B64%" echo ZHNoID0gR2V0LUNvbW1hbmQgZHNoIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlCmlmICgtbm90ICRkc2gpIHsKICAgIFNh
>>"%B64%" echo eSAnICDmnKrmo4DmtYvliLAgRFNILCDor7flhYjlronoo4Ug5YyFMSAo5qC45b+D5YyFKSEnICRZZWxsb3cKICAgIFJlYWQtSG9z
>>"%B64%" echo dCAn5oyJ5Zue6L2m6YCA5Ye6JzsgZXhpdCAxCn0KU2F5ICcgIE9LJyAkR3JlZW4KCiMgMi4g5a6J6KOF5Lq65qC86aKE6K6+ClNh
>>"%B64%" echo eSAnWzIvM10g5a6J6KOF54ix6I6J5Lq65qC8IC4uLicKJHByZXNldERpciA9IEpvaW4tUGF0aCAkZHNoSG9tZSAnLmFnZW50LXBy
>>"%B64%" echo ZXNldHNcZWx5c2lhJwpOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoICRwcmVzZXREaXIgLUZvcmNlIHwgT3V0LU51
>>"%B64%" echo bGwKJHByZXNldFNyYyA9IEpvaW4tUGF0aCAkc2NyaXB0RGlyICdwcmVzZXQnCmlmIChUZXN0LVBhdGggKEpvaW4tUGF0aCAkcHJl
>>"%B64%" echo c2V0U3JjICdhZ2VudC5jb3JkaXMueW1sJykpIHsKICAgIENvcHktSXRlbSAoSm9pbi1QYXRoICRwcmVzZXRTcmMgJyonKSAkcHJl
>>"%B64%" echo c2V0RGlyIC1SZWN1cnNlIC1Gb3JjZQogICAgU2F5ICcgIE9LIOS6uuagvOmihOiuvuW3suWuieijhSAo5paw5Lya6K+d5Y+v6YCJ
>>"%B64%" echo IGVseXNpYSknICRHcmVlbgp9IGVsc2UgewogICAgU2F5ICcgIOacquaJvuWIsCBwcmVzZXQg55uu5b2VLCDljIXlj6/og73kuI3l
>>"%B64%" echo rozmlbQnICRZZWxsb3cKfQoKIyAzLiDor63pn7MgKENvc3lWb2ljZSDlj6/pgIksIOS9k+enr+WkpykKU2F5ICdbMy8zXSDor63p
>>"%B64%" echo n7Ppg6jliIYgLi4uJwpTYXkgJyAg5aOw57q/IGNsaXAg5bey6ZqP5YyF6ZmE5bimICh2b2ljZS1jbGlwcy8pJyAkR3JlZW4KU2F5
>>"%B64%" echo ICcgIENvc3lWb2ljZSDmqKHlnoso57qmM0dCKSDpnIDmiYvliqjkuIvovb06JyAkWWVsbG93ClNheSAnICAgIDEuIGh0dHBzOi8v
>>"%B64%" echo bW9kZWxzY29wZS5jbi9tb2RlbHMvaWljL0Nvc3lWb2ljZTItMC41QicKU2F5ICcgICAgMi4g6Kej5Y6L5YiwIEQ6XENvc3lWb2lj
>>"%B64%" echo ZVxwcmV0cmFpbmVkX21vZGVsc1wnClNheSAnICAgIDMuIOWjsOe6v+aWh+S7tuaUviBEOlxDb3N5Vm9pY2VcZWx5c2lhLXZvaWNl
>>"%B64%" echo XGNsaXBzXCcKU2F5ICcgIOivpue7huatpemqpOingSBSRUFETUUubWQg56ysIDMg6IqCJyAkWWVsbG93CgojIOiuvue9rum7mOiu
>>"%B64%" echo pOmihOiuvuS4uiBlbHlzaWEKJHNldHRpbmdzUGF0aCA9IEpvaW4tUGF0aCAkZHNoSG9tZSAnc2V0dGluZ3MueWFtbCcKaWYgKFRl
>>"%B64%" echo c3QtUGF0aCAkc2V0dGluZ3NQYXRoKSB7CiAgICAkY29udGVudCA9IEdldC1Db250ZW50ICRzZXR0aW5nc1BhdGggLVJhdyAtRW5j
>>"%B64%" echo b2RpbmcgVVRGOAogICAgaWYgKCRjb250ZW50IC1ub3RtYXRjaCAnYWdlbnQtcHJlc2V0cycpIHsKICAgICAgICBBZGQtQ29udGVu
>>"%B64%" echo dCAkc2V0dGluZ3NQYXRoICJgbmFnZW50LXByZXNldHM6YG4gIGRlZmF1bHQ6IGVseXNpYWBuIiAtRW5jb2RpbmcgVVRGOAogICAg
>>"%B64%" echo ICAgIFNheSAnICDlt7Lorr7nva7pu5jorqTpooTorr4gPSBlbHlzaWEnICRHcmVlbgogICAgfQp9CgpTYXkgJycKU2F5ICcgIOWu
>>"%B64%" echo jOaIkCEg6YeN5ZCvIERTSCAo5YWz5o6J56qX5Y+j6YeN5pawIGRzaCB3ZWIpJyAkR3JlZW4KU2F5ICcgIOaWsOS8muivnemAieaL
>>"%B64%" echo qSBlbHlzaWEg6aKE6K6+IC0+IOeIseiOieWwseWcqOetieS9oOWVpiEnICRHcmVlbgpTYXkgJycKUmVhZC1Ib3N0ICfmjInlm57o
>>"%B64%" echo vablhbPpl60nCg==
>>"%B64%" echo -----END CERTIFICATE-----

certutil -decode -f "%B64%" "%PS1%" >nul 2>&1

if not exist "%PS1%" (
    echo Decode failed. Please run as administrator.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" "%~dp0"

del "%B64%" "%PS1%" >nul 2>&1

pause
