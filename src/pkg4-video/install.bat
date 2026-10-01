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
>>"%B64%" echo lZDilZDilZDilZDilZDilZAnICRQaW5rClNheSAnJwoKJGJhc2UgPSAnRDpcQUlcSkFSVklTJwokc2NyaXB0RGlyID0gJGFyZ3Nb
>>"%B64%" echo MF0uVHJpbUVuZCgnXCcpCk5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGJhc2UgLUZvcmNlIHwgT3V0LU51bGwK
>>"%B64%" echo CiMgLS0tLS0tLS0tLSBbMS80XSDnjq/looPmo4Dmn6UgLS0tLS0tLS0tLQpTYXkgJ1sxLzRdIOajgOafpeeOr+WigyAuLi4nCmlm
>>"%B64%" echo ICgtbm90IChHZXQtQ29tbWFuZCBkc2ggLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUpKSB7CiAgICBTYXkgJyAg5pyq5qOA
>>"%B64%" echo 5rWL5YiwIERTSCwg6K+35YWI5a6J6KOFIOWMhTEgKOaguOW/g+WMhSkhJyAkWWVsbG93CiAgICBSZWFkLUhvc3QgJ+aMieWbnui9
>>"%B64%" echo pumAgOWHuic7IGV4aXQgMQp9CiMgZHNoIOeahOaPkuS7tueuoeeQhuWGhemDqOi9rOWPkee7mSBwbnBtLCDmsqHmnIkgcG5wbSDk
>>"%B64%" echo vJrnm7TmjqXlpLHotKUgKGV4aXQgMTI3KQppZiAoLW5vdCAoR2V0LUNvbW1hbmQgcG5wbSAtRXJyb3JBY3Rpb24gU2lsZW50bHlD
>>"%B64%" echo b250aW51ZSkpIHsKICAgIFNheSAnICDmnKrmo4DmtYvliLAgcG5wbSwg5q2j5Zyo5a6J6KOFIC4uLicgJFllbGxvdwogICAgY21k
>>"%B64%" echo IC9jICJucG0gaW5zdGFsbCAtZyBwbnBtID5udWwgMj4mMSIKICAgIGlmICgtbm90IChHZXQtQ29tbWFuZCBwbnBtIC1FcnJvckFj
>>"%B64%" echo dGlvbiBTaWxlbnRseUNvbnRpbnVlKSkgewogICAgICAgIFNheSAnICAhISBwbnBtIOijheS4jeS4iiwg6K+35omL5Yqo5omn6KGM
>>"%B64%" echo OiBucG0gaW5zdGFsbCAtZyBwbnBtJyAkWWVsbG93CiAgICAgICAgUmVhZC1Ib3N0ICfmjInlm57ovabpgIDlh7onOyBleGl0IDEK
>>"%B64%" echo ICAgIH0KfQpTYXkgJyAgT0sgZHNoICsgcG5wbSDpg73lnKgnICRHcmVlbgoKIyBmZm1wZWcgLyBmZnByb2JlIOaYr+inhumikeWK
>>"%B64%" echo n+iDveeahOWRveagueWtkDog5rKh5pyJ5a6D5o+S5Lu254Wn5qC35Yqg6L29LCDkvYblt6XlhbfkuIDosIPlsLHmiqXplJnjgIIK
>>"%B64%" echo IyDlj6rmj5DnpLrkuI3oh6rliqjoo4Ug4oCU4oCUIGZmbXBlZyDkvZPnp6/lpKfjgIHoo4Xms5XlpJrjgIHoh6rliqjoo4Xlrrnm
>>"%B64%" echo mJPnv7vovaYsIOiuqeeUqOaIt+aJi+WKqOOAggokZmYgPSBHZXQtQ29tbWFuZCBmZm1wZWcgLUVycm9yQWN0aW9uIFNpbGVudGx5
>>"%B64%" echo Q29udGludWUKJGZwID0gR2V0LUNvbW1hbmQgZmZwcm9iZSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZQppZiAoLW5vdCAk
>>"%B64%" echo ZmYgLW9yIC1ub3QgJGZwKSB7CiAgICBTYXkgJycgJFllbGxvdwogICAgU2F5ICcgIOacquajgOa1i+WIsCBmZm1wZWcgLyBmZnBy
>>"%B64%" echo b2JlIOKAlOKAlCDop4bpopHlip/og73lv4Xpobvkvp3otZblroMhJyAkWWVsbG93CiAgICBTYXkgJyAg5rKh5pyJ55qE6K+dOiDm
>>"%B64%" echo j5Lku7bog73oo4XkuIosIOS9huaKveW4py9HSUYv5oC757uT57G75bel5YW35LiA55So5bCx5oql6ZSZ44CCJyAkWWVsbG93CiAg
>>"%B64%" echo ICBTYXkgJyAg6K+35omL5Yqo5a6J6KOFICjkuozpgInkuIApOicgJFllbGxvdwogICAgU2F5ICcgICAgMS4g5paw5byA5LiA5Liq
>>"%B64%" echo 5ZG95Luk6KGM56qX5Y+j5omn6KGMOiAgd2luZ2V0IGluc3RhbGwgR3lhbi5GRm1wZWcnICRZZWxsb3cKICAgIFNheSAnICAgICAg
>>"%B64%" echo IOijheWujOimgemHjeW8gOeql+WPoyAo6K6pIFBBVEgg55Sf5pWIKScgJFllbGxvdwogICAgU2F5ICcgICAgMi4g5oiW5YiwIGh0
>>"%B64%" echo dHBzOi8vd3d3Lmd5YW4uZGV2L2ZmbXBlZy9idWlsZHMvIOS4i+i9vScgJFllbGxvdwogICAgU2F5ICcgICAgICAgcmVsZWFzZS1l
>>"%B64%" echo c3NlbnRpYWxzLnppcCwg6Kej5Y6L5ZCO5oqK6YeM6Z2i55qEIGJpbiDnm67lvZXliqDov5vns7vnu58gUEFUSCcgJFllbGxvdwog
>>"%B64%" echo ICAgU2F5ICcgIOW3suijheWlveWwseaMieWbnui9pue7p+e7rTsg5oOz5Lul5ZCO5YaN6KOF5bCx55u05o6l5YWz5o6J5pys56qX
>>"%B64%" echo 5Y+j44CCJyAkWWVsbG93CiAgICBSZWFkLUhvc3QgJ+aMieWbnui9pue7p+e7rScKICAgICRmZiA9IEdldC1Db21tYW5kIGZmbXBl
>>"%B64%" echo ZyAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZQogICAgJGZwID0gR2V0LUNvbW1hbmQgZmZwcm9iZSAtRXJyb3JBY3Rpb24g
>>"%B64%" echo U2lsZW50bHlDb250aW51ZQp9CmlmICgkZmYgLWFuZCAkZnApIHsKICAgICMg5LiK5Y+kIGZmbXBlZyAo5q+U5aaCIDIwMTMg5bm0
>>"%B64%" echo 55qEKSDog73ot5EsIOS9huaJi+acuuaLjeeahCBIRVZDL0guMjY1IOinhumikeino+S4jeWKqCwg5o+Q5YmN5o+Q6YaSCiAgICAk
>>"%B64%" echo dmVyID0gKCYgZmZtcGVnIC12ZXJzaW9uIHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMikgLWpvaW4gJyAnCiAgICAkbWFqb3IgPSAk
>>"%B64%" echo bnVsbDsgJGJ1aWx0WWVhciA9ICRudWxsCiAgICBpZiAoJHZlciAtbWF0Y2ggJ3ZlcnNpb25ccysoXGQrKVwuJykgeyAkbWFqb3Ig
>>"%B64%" echo PSBbaW50XSRNYXRjaGVzWzFdIH0KICAgIGlmICgkdmVyIC1tYXRjaCAnYnVpbHQgb24gLio/KFxkezR9KScpIHsgJGJ1aWx0WWVh
>>"%B64%" echo ciA9IFtpbnRdJE1hdGNoZXNbMV0gfQogICAgaWYgKCgkbnVsbCAtbmUgJG1ham9yIC1hbmQgJG1ham9yIC1sdCA0KSAtb3IgKCRu
>>"%B64%" echo dWxsIC1lcSAkbWFqb3IgLWFuZCAkbnVsbCAtbmUgJGJ1aWx0WWVhciAtYW5kICRidWlsdFllYXIgLWx0IDIwMTkpKSB7CiAgICAg
>>"%B64%" echo ICAgU2F5ICIgICEhIOajgOa1i+WIsOW+iOiAgeeahCBmZm1wZWc6ICQoJHZlci5TdWJzdHJpbmcoMCwgW01hdGhdOjpNaW4oNzAs
>>"%B64%" echo ICR2ZXIuTGVuZ3RoKSkpIiAkWWVsbG93CiAgICAgICAgU2F5ICcgICAgIOW4uOinhOinhumikeiDveeUqCwg5L2G5omL5py65ouN
>>"%B64%" echo 55qEIEhFVkMvSC4yNjUg5Lya6Kej5LiN5YqoICjmir3luKflpLHotKUp44CCJyAkWWVsbG93CiAgICAgICAgU2F5ICcgICAgIOW7
>>"%B64%" echo uuiuruaNouaWsOeJiDogd2luZ2V0IGluc3RhbGwgR3lhbi5GRm1wZWcgKOazqOaEj+iuqeaWsOeJiOeblui/h+aXp+eJiCBQQVRI
>>"%B64%" echo KScgJFllbGxvdwogICAgfSBlbHNlIHsKICAgICAgICBTYXkgJyAgT0sgZmZtcGVnIOW3suWwseS9jScgJEdyZWVuCiAgICB9Cn0g
>>"%B64%" echo ZWxzZSB7CiAgICBTYXkgJyAgISEgZmZtcGVnIOS7jeacquajgOa1i+WIsCDigJTigJQg5YWI57un57ut6KOF5o+S5Lu2LCDop4bp
>>"%B64%" echo opHlip/og73mmoLkuI3lj6/nlKjjgIInICRZZWxsb3cKICAgIFNheSAnICAgICDku6XlkI7oo4Xlpb0gZmZtcGVnIOmHjeWQryBk
>>"%B64%" echo c2ggd2ViIOWNs+WPrywg5LiN55So6YeN6LeR5pys5YyF44CCJyAkWWVsbG93Cn0KCiMgLS0tLS0tLS0tLSBbMi80XSDlpI3liLbm
>>"%B64%" echo j5Lku7YgLS0tLS0tLS0tLQpTYXkgJ1syLzRdIOWkjeWItuaPkuS7tiAuLi4nCiRwbHVnaW5EaXIgPSBKb2luLVBhdGggJGJhc2Ug
>>"%B64%" echo J2RzaC12aWRlby1mcmFtZXMnCk5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJHBsdWdpbkRpciAtRm9yY2UgfCBP
>>"%B64%" echo dXQtTnVsbApDb3B5LUl0ZW0gKEpvaW4tUGF0aCAkc2NyaXB0RGlyICdwbHVnaW5cKicpICRwbHVnaW5EaXIgLVJlY3Vyc2UgLUZv
>>"%B64%" echo cmNlClNheSAnICBPSyDlt7LlpI3liLbliLAgRDpcQUlcSkFSVklTXGRzaC12aWRlby1mcmFtZXMnICRHcmVlbgoKIyAtLS0tLS0t
>>"%B64%" echo LS0tIFszLzRdIOWuieijheaPkuS7tuS+nei1liAtLS0tLS0tLS0tCiMg5o+S5Lu25b+F6aG76Ieq5bim5LiA5Lu9IG5vZGVfbW9k
>>"%B64%" echo dWxlczogZHNoIOeahCBwcm9maWxlIOWPquijhSBidW5kbGUg6Ieq6LqrLAojIOS4jeaPkOS+m+aPkuS7tuimgeeUqOeahCBAZGVl
>>"%B64%" echo cHNlZWstYWkvKiDljIUsIOmdoCBwcm9maWxlIOaYr+ino+aekOS4jeWIsOeahOOAggpTYXkgJ1szLzRdIOWuieijheaPkuS7tuS+
>>"%B64%" echo nei1liAo6IGU572RLCDnuqYgMSDliIbpkp8pIC4uLicKUHVzaC1Mb2NhdGlvbiAkcGx1Z2luRGlyCmNtZCAvYyAibnBtIGluc3Rh
>>"%B64%" echo bGwgLS1uby1hdWRpdCAtLW5vLWZ1bmQgPm51bCAyPiYxIgokbnBtT2sgPSAoJExBU1RFWElUQ09ERSAtZXEgMCkgLWFuZCAoVGVz
>>"%B64%" echo dC1QYXRoIChKb2luLVBhdGggJHBsdWdpbkRpciAnbm9kZV9tb2R1bGVzJykpClBvcC1Mb2NhdGlvbgppZiAoJG5wbU9rKSB7CiAg
>>"%B64%" echo ICBTYXkgJyAgT0sg5L6d6LWW5bey5bCx5L2NJyAkR3JlZW4KfSBlbHNlIHsKICAgIFNheSAnICAhISDkvp3otZbmsqHoo4XkuIos
>>"%B64%" echo IOaPkuS7tuS8muWKoOi9veWksei0pScgJFllbGxvdwogICAgU2F5ICcgICAgIOaJi+WKqOmHjeivlTogY2QgRDpcQUlcSkFSVklT
>>"%B64%" echo XGRzaC12aWRlby1mcmFtZXMgJiYgbnBtIGluc3RhbGwnICRZZWxsb3cKfQoKIyAtLS0tLS0tLS0tIFs0LzRdIOijhei/myBEU0gg
>>"%B64%" echo LS0tLS0tLS0tLQojIOacrOaPkuS7tuS4jemcgOimgeW+gCBwcm9maWxlIOeahCBjb3JkaXMucGF0Y2gueW1sIOWGmemFjee9riAo
>>"%B64%" echo 5LiN5YOPIFFRIOahpeimgSB0b2tlbi9jd2QpLAojIGJ1bmRsZSBwYXRjaCDnlLHmj5Lku7boh6rluKbnmoQgY29yZGlzLnBhdGNo
>>"%B64%" echo LnltbCDmj5DkvpvjgIIKU2F5ICdbNC80XSDmiormj5Lku7boo4Xov5sgRFNIIChwcm9maWxlOiB3ZWIpIC4uLicKJHBsdWdpbkRp
>>"%B64%" echo clNsYXNoID0gJHBsdWdpbkRpci5SZXBsYWNlKCdcJywgJy8nKQpjbWQgL2MgImRzaCBwbHVnaW4gLS1wcm9maWxlIHdlYiBhZGQg
>>"%B64%" echo YCIkcGx1Z2luRGlyU2xhc2hgIiAyPiYxIgppZiAoJExBU1RFWElUQ09ERSAtbmUgMCkgewogICAgU2F5ICcgICEhIOijhei/myBE
>>"%B64%" echo U0gg5aSx6LSlICjkuIrpnaLmnInmiqXplJksIOWPr+WkjeWItue7meS9nOiAhSknICRZZWxsb3cKfSBlbHNlIHsKICAgIFNheSAn
>>"%B64%" echo ICBPSyDmj5Lku7blt7Lov5sgd2ViIHByb2ZpbGUnICRHcmVlbgp9CgpTYXkgJycKU2F5ICcgIOijheWujOS6hjonICRHcmVlbgpT
>>"%B64%" echo YXkgJyAgMS4g6YeN5ZCvIGRzaCB3ZWI6IOWFs+aOieWug+eahOeql+WPoywg5YaN5Y+M5Ye75qGM6Z2i55qEIHN0YXJ0LWVseXNp
>>"%B64%" echo YS5iYXQnICRHcmVlbgpTYXkgJyAgMi4g5rWP6KeI5Zmo5omT5byAIGh0dHA6Ly8xMjcuMC4wLjE6MzA4MCwg55u05o6l5a+554ix
>>"%B64%" echo 6I6J6K+0OicgJEdyZWVuClNheSAnICAgICAi5biu5oiR55yL5LiLIEQ6XHZpZGVvc1x4eHgubXA0IOmHjOWPkeeUn+S6huS7gOS5
>>"%B64%" echo iCInICRHcmVlbgpTYXkgJyAgICAgIuaKiui/meauteinhumikeWBmuaIkCBHSUYiIC8gIui/meS4quinhumikeWkmumVv+OAgeS7
>>"%B64%" echo gOS5iOWIhui+qOeOhyInICRHcmVlbgpTYXkgJyAg6K+m57uG6KeB5YyF6YeM55qEIFJFQURNRS5tZCcgJEdyZWVuClNheSAnJwpS
>>"%B64%" echo ZWFkLUhvc3QgJ+aMieWbnui9puWFs+mXrScK
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
