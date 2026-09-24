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
>>"%B64%" echo IyAtKi0gY29kaW5nOiB1dGYtOCAtKi0KIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
>>"%B64%" echo PT09PT09PT09PT0KIyAg5YyFMyDCtyBRUSDmianlsZUg5LiA6ZSu5a6J6KOFCiMgIOWJjeaPkDog5bey6KOFIOWMhTEgKERlZXBT
>>"%B64%" echo ZWVrIEhhcm5lc3MpCiMgIOeUqOazlTog5Y+M5Ye7IGluc3RhbGwuYmF0IC0+IOiHquWKqOWujOaIkCAtPiDmiavnoIHnmbvlvZXl
>>"%B64%" echo sI/lj7cKIyAg5Yqf6IO9OiBRUSDnp4HogYov576k6IGKICjmloflrZcr6K+t6Z+zKSwg5Lu75Yqh55u06YCaCiMgPT09PT09PT09
>>"%B64%" echo PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiRFcnJvckFjdGlvblByZWZlcmVuY2Ug
>>"%B64%" echo PSAnU3RvcCcKJEN5YW4gPSAnQ3lhbic7ICRHcmVlbiA9ICdHcmVlbic7ICRZZWxsb3cgPSAnWWVsbG93JzsgJFBpbmsgPSAnTWFn
>>"%B64%" echo ZW50YScKZnVuY3Rpb24gU2F5KCRtLCAkYyA9ICRDeWFuKSB7IFdyaXRlLUhvc3QgIiAgJG0iIC1Gb3JlZ3JvdW5kQ29sb3IgJGMg
>>"%B64%" echo fQoKU2F5ICfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAnICRQaW5rClNheSAnICDniLHojokgUVEg5omp
>>"%B64%" echo 5bGVIMK3IOS4gOmUruWuieijhScgJFBpbmsKU2F5ICfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDi
>>"%B64%" echo lZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAnICRQ
>>"%B64%" echo aW5rClNheSAnJwoKJGJhc2UgPSAnRDpcQUlcSkFSVklTJwokZHNoSG9tZSA9IEpvaW4tUGF0aCAkZW52OlVTRVJQUk9GSUxFICcu
>>"%B64%" echo ZHNoJwokc2NyaXB0RGlyID0gJGFyZ3NbMF0uVHJpbUVuZCgnXCcpCk5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGgg
>>"%B64%" echo JGJhc2UgLUZvcmNlIHwgT3V0LU51bGwKCiMgLS0tLS0tLS0tLSBbMS81XSDnjq/looPmo4Dmn6UgLS0tLS0tLS0tLQpTYXkgJ1sx
>>"%B64%" echo LzVdIOajgOafpeeOr+WigyAuLi4nCmlmICgtbm90IChHZXQtQ29tbWFuZCBkc2ggLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGlu
>>"%B64%" echo dWUpKSB7CiAgICBTYXkgJyAg5pyq5qOA5rWL5YiwIERTSCwg6K+35YWI5a6J6KOFIOWMhTEgKOaguOW/g+WMhSkhJyAkWWVsbG93
>>"%B64%" echo CiAgICBSZWFkLUhvc3QgJ+aMieWbnui9pumAgOWHuic7IGV4aXQgMQp9CiMgZHNoIOeahOaPkuS7tueuoeeQhuWGhemDqOi9rOWP
>>"%B64%" echo kee7mSBwbnBtLCDmsqHmnIkgcG5wbSDkvJrnm7TmjqXlpLHotKUgKGV4aXQgMTI3KQppZiAoLW5vdCAoR2V0LUNvbW1hbmQgcG5w
>>"%B64%" echo bSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSkpIHsKICAgIFNheSAnICDmnKrmo4DmtYvliLAgcG5wbSwg5q2j5Zyo5a6J
>>"%B64%" echo 6KOFIC4uLicgJFllbGxvdwogICAgY21kIC9jICJucG0gaW5zdGFsbCAtZyBwbnBtID5udWwgMj4mMSIKICAgIGlmICgtbm90IChH
>>"%B64%" echo ZXQtQ29tbWFuZCBwbnBtIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKSkgewogICAgICAgIFNheSAnICAhISBwbnBtIOij
>>"%B64%" echo heS4jeS4iiwg6K+35omL5Yqo5omn6KGMOiBucG0gaW5zdGFsbCAtZyBwbnBtJyAkWWVsbG93CiAgICAgICAgUmVhZC1Ib3N0ICfm
>>"%B64%" echo jInlm57ovabpgIDlh7onOyBleGl0IDEKICAgIH0KfQpTYXkgJyAgT0sgZHNoICsgcG5wbSDpg73lnKgnICRHcmVlbgoKIyAtLS0t
>>"%B64%" echo LS0tLS0tIFsyLzVdIOWkjeWItuiEmuacrOS4juaPkuS7tiAtLS0tLS0tLS0tClNheSAnWzIvNV0g5aSN5Yi26ISa5pys5LiO5o+S
>>"%B64%" echo 5Lu2IC4uLicKQ29weS1JdGVtIChKb2luLVBhdGggJHNjcmlwdERpciAncXEtZWx5c2lhLnB5JykgKEpvaW4tUGF0aCAkYmFzZSAn
>>"%B64%" echo cXEtZWx5c2lhLnB5JykgLUZvcmNlCk5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggKEpvaW4tUGF0aCAkYmFzZSAn
>>"%B64%" echo dGFza3MnKSAtRm9yY2UgfCBPdXQtTnVsbAoKJHBsdWdpbkRpciA9IEpvaW4tUGF0aCAkYmFzZSAnZHNoLXFxLWJyaWRnZScKTmV3
>>"%B64%" echo LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAtUGF0aCAkcGx1Z2luRGlyIC1Gb3JjZSB8IE91dC1OdWxsCkNvcHktSXRlbSAoSm9p
>>"%B64%" echo bi1QYXRoICRzY3JpcHREaXIgJ3BsdWdpblwqJykgJHBsdWdpbkRpciAtUmVjdXJzZSAtRm9yY2UKU2F5ICcgIE9LIOW3suWkjeWI
>>"%B64%" echo tuWIsCBEOlxBSVxKQVJWSVMnICRHcmVlbgoKIyAtLS0tLS0tLS0tIFszLzVdIOWuieijheaPkuS7tuS+nei1liAtLS0tLS0tLS0t
>>"%B64%" echo CiMg5o+S5Lu25b+F6aG76Ieq5bim5LiA5Lu9IG5vZGVfbW9kdWxlczogZHNoIOeahCBwcm9maWxlIOWPquijhSBidW5kbGUg6Ieq
>>"%B64%" echo 6LqrLAojIOS4jeaPkOS+m+aPkuS7tuimgeeUqOeahCBAZGVlcHNlZWstYWkvKiDljIUsIOmdoCBwcm9maWxlIOaYr+ino+aekOS4
>>"%B64%" echo jeWIsOeahOOAggpTYXkgJ1szLzVdIOWuieijheaPkuS7tuS+nei1liAo6IGU572RLCDnuqYgMSDliIbpkp8pIC4uLicKUHVzaC1M
>>"%B64%" echo b2NhdGlvbiAkcGx1Z2luRGlyCmNtZCAvYyAibnBtIGluc3RhbGwgLS1uby1hdWRpdCAtLW5vLWZ1bmQgPm51bCAyPiYxIgokbnBt
>>"%B64%" echo T2sgPSAoJExBU1RFWElUQ09ERSAtZXEgMCkgLWFuZCAoVGVzdC1QYXRoIChKb2luLVBhdGggJHBsdWdpbkRpciAnbm9kZV9tb2R1
>>"%B64%" echo bGVzJykpClBvcC1Mb2NhdGlvbgppZiAoJG5wbU9rKSB7CiAgICBTYXkgJyAgT0sg5L6d6LWW5bey5bCx5L2NJyAkR3JlZW4KfSBl
>>"%B64%" echo bHNlIHsKICAgIFNheSAnICAhISDkvp3otZbmsqHoo4XkuIosIOaPkuS7tuS8muWKoOi9veWksei0pScgJFllbGxvdwogICAgU2F5
>>"%B64%" echo ICcgICAgIOaJi+WKqOmHjeivlTogY2QgRDpcQUlcSkFSVklTXGRzaC1xcS1icmlkZ2UgJiYgbnBtIGluc3RhbGwnICRZZWxsb3cK
>>"%B64%" echo fQoKIyAtLS0tLS0tLS0tIFs0LzVdIOijhei/myBEU0ggLS0tLS0tLS0tLQpTYXkgJ1s0LzVdIOaKiuaPkuS7tuijhei/myBEU0gg
>>"%B64%" echo KHByb2ZpbGU6IHdlYikgLi4uJwokcGx1Z2luRGlyU2xhc2ggPSAkcGx1Z2luRGlyLlJlcGxhY2UoJ1wnLCAnLycpCmNtZCAvYyAi
>>"%B64%" echo ZHNoIHBsdWdpbiAtLXByb2ZpbGUgd2ViIGFkZCBgIiRwbHVnaW5EaXJTbGFzaGAiIDI+JjEiCmlmICgkTEFTVEVYSVRDT0RFIC1u
>>"%B64%" echo ZSAwKSB7CiAgICBTYXkgJyAgISEg6KOF6L+bIERTSCDlpLHotKUgKOS4iumdouacieaKpemUmSwg5Y+v5aSN5Yi257uZ5L2c6ICF
>>"%B64%" echo KScgJFllbGxvdwp9IGVsc2UgewogICAgU2F5ICcgIE9LIOaPkuS7tuW3sui/myB3ZWIgcHJvZmlsZScgJEdyZWVuCn0KCiMg5b6A
>>"%B64%" echo IHByb2ZpbGUg5YaZ5o+S5Lu26YWN572uICh0b2tlbiDnlZnnqbogPSDmnKzmnLrkuI3moKHpqow7IOimgeaUtue0p+WwseWcqOS4
>>"%B64%" echo pOi+uemDveWhq+WQjOS4gOS4quWAvCkKJHBhdGNoUGF0aCA9IEpvaW4tUGF0aCAkZHNoSG9tZSAncHJvZmlsZXNcd2ViXGNvcmRp
>>"%B64%" echo cy5wYXRjaC55bWwnCmlmIChUZXN0LVBhdGggJHBhdGNoUGF0aCkgewogICAgJGNvbnRlbnQgPSBHZXQtQ29udGVudCAkcGF0Y2hQ
>>"%B64%" echo YXRoIC1SYXcgLUVuY29kaW5nIFVURjgKICAgIGlmICgkY29udGVudCAtbm90bWF0Y2ggJ2RzaC1xcS1icmlkZ2UnKSB7CiAgICAg
>>"%B64%" echo ICAgJGNvbnRlbnQgPSAoJGNvbnRlbnQgLXJlcGxhY2UgJyg/bSleXFtcXVxzKiQnLCAnJykuVHJpbUVuZCgpCiAgICAgICAgJGNv
>>"%B64%" echo bnRlbnQgKz0gImBuLSBpZDogZHNoLXFxLWJyaWRnZWBuICBjb25maWc6YG4gICAgYWdlbnRQcmVzZXQ6ICdlbHlzaWEnYG4gICAg
>>"%B64%" echo Y3dkOiAnRDovQUkvSkFSVklTJ2BuIgogICAgICAgIFNldC1Db250ZW50IC1QYXRoICRwYXRjaFBhdGggLVZhbHVlICRjb250ZW50
>>"%B64%" echo IC1FbmNvZGluZyBVVEY4CiAgICAgICAgU2F5ICcgIE9LIOaPkuS7tumFjee9ruW3suWGmeWFpSBwcm9maWxlJyAkR3JlZW4KICAg
>>"%B64%" echo IH0gZWxzZSB7CiAgICAgICAgU2F5ICcgIE9LIOaPkuS7tumFjee9ruW3suWtmOWcqCwg6Lez6L+HJyAkR3JlZW4KICAgIH0KfSBl
>>"%B64%" echo bHNlIHsKICAgIFNheSAnICDmnKrmib7liLAgcHJvZmlsZSDphY3nva4sIOivt+WFiOi/kOihjOS4gOasoSBkc2ggd2ViIOWGjemH
>>"%B64%" echo jei3keacrOWMhScgJFllbGxvdwp9CgojIC0tLS0tLS0tLS0gWzUvNV0gTmFwQ2F0IC0tLS0tLS0tLS0KU2F5ICdbNS81XSBOYXBD
>>"%B64%" echo YXQgKFFRIOWNj+iurikgLi4uJwokbmFwY2F0RGlyID0gSm9pbi1QYXRoICRiYXNlICduYXBjYXQnCmlmIChUZXN0LVBhdGggKEpv
>>"%B64%" echo aW4tUGF0aCAkbmFwY2F0RGlyICduYXBjYXQuYmF0JykpIHsKICAgIFNheSAnICBPSyDlt7LlrZjlnKgnICRHcmVlbgp9IGVsc2Ug
>>"%B64%" echo ewogICAgU2F5ICcgIOmcgOimgeS4i+i9vSBOYXBDYXQgKOe6piAxMTBNQik6JyAkWWVsbG93CiAgICBTYXkgJyAgaHR0cHM6Ly9n
>>"%B64%" echo aXRodWIuY29tL05hcE5la28vTmFwQ2F0UVEvcmVsZWFzZXMnICRZZWxsb3cKICAgIFNheSAnICDkuIvovb0gTmFwQ2F0LlNoZWxs
>>"%B64%" echo LldpbmRvd3MuTm9kZS56aXAg6Kej5Y6L5YiwOicgJFllbGxvdwogICAgU2F5ICIgICRuYXBjYXREaXIiICRZZWxsb3cKICAgIFJl
>>"%B64%" echo YWQtSG9zdCAn5LiL6L296Kej5Y6L5a6M5oiQ5ZCO5oyJ5Zue6L2m57un57utJwp9CiRjb25maWdEaXIgPSBKb2luLVBhdGggJG5h
>>"%B64%" echo cGNhdERpciAnbmFwY2F0XGNvbmZpZycKTmV3LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAtUGF0aCAkY29uZmlnRGlyIC1Gb3Jj
>>"%B64%" echo ZSB8IE91dC1OdWxsCiRvbmVib3RQYXRoID0gSm9pbi1QYXRoICRjb25maWdEaXIgJ29uZWJvdDExLmpzb24nCmlmICgtbm90IChU
>>"%B64%" echo ZXN0LVBhdGggJG9uZWJvdFBhdGgpKSB7CiAgICBAJwp7CiAgIm5ldHdvcmsiOiB7CiAgICAid2Vic29ja2V0U2VydmVycyI6IFsK
>>"%B64%" echo ICAgICAgewogICAgICAgICJlbmFibGUiOiB0cnVlLAogICAgICAgICJuYW1lIjogImVseXNpYS13cyIsCiAgICAgICAgImhvc3Qi
>>"%B64%" echo OiAiMTI3LjAuMC4xIiwKICAgICAgICAicG9ydCI6IDMwMDEsCiAgICAgICAgIm1lc3NhZ2VQb3N0Rm9ybWF0IjogImFycmF5IiwK
>>"%B64%" echo ICAgICAgICAicmVwb3J0U2VsZk1lc3NhZ2UiOiBmYWxzZSwKICAgICAgICAidG9rZW4iOiAiIgogICAgICB9CiAgICBdCiAgfQp9
>>"%B64%" echo CidAIHwgU2V0LUNvbnRlbnQgLVBhdGggJG9uZWJvdFBhdGggLUVuY29kaW5nIFVURjgKfQpTYXkgJyAgT0sgT25lQm90IOmFjee9
>>"%B64%" echo ruW3suWGmeWFpSAo56uv5Y+jIDMwMDEpJyAkR3JlZW4KCiRsYXVuY2hlciA9IEpvaW4tUGF0aCAkbmFwY2F0RGlyICduYXBjYXRc
>>"%B64%" echo bGF1bmNoZXIuYmF0JwppZiAoVGVzdC1QYXRoICRsYXVuY2hlcikgewogICAgU3RhcnQtUHJvY2VzcyBjbWQgLUFyZ3VtZW50TGlz
>>"%B64%" echo dCAiL2MiLCJjZCAvZCAkbmFwY2F0RGlyXG5hcGNhdCAmJiBsYXVuY2hlci5iYXQiIC1WZXJiIFJ1bkFzCiAgICBTYXkgJyAg5bey
>>"%B64%" echo 5ZCv5YqoICjlpoLmnIkgVUFDIOW8ueeql+ivt+eCueaYryksIOivt+eUqCBRUSDlsI/lj7fmiavnoIHnmbvlvZUnICRZZWxsb3cK
>>"%B64%" echo fSBlbHNlIHsKICAgIFNheSAnICDmnKrmib7liLAgbGF1bmNoZXIuYmF0LCDor7fmo4Dmn6UgTmFwQ2F0IOino+WOi+i3r+W+hCcg
>>"%B64%" echo JFllbGxvdwp9CgpTYXkgJycKU2F5ICcgIOeZu+W9leWujOaIkOWQjjonICRHcmVlbgpTYXkgJyAgMS4g56Gu5L+dIGRzaCDlnKjo
>>"%B64%" echo t5EgKOWPjOWHu+ahjOmdoueahCBzdGFydC1lbHlzaWEuYmF0KScgJEdyZWVuClNheSAnICAyLiDov5DooYzliIbouqs6IHB5dGhv
>>"%B64%" echo biBEOlxBSVxKQVJWSVNccXEtZWx5c2lhLnB5JyAkR3JlZW4KU2F5ICcgIDMuIOWkp+WPt+WKoOWwj+WPt+WlveWPiyAtPiDlj5Hm
>>"%B64%" echo tojmga8gPSDlkozniLHojonogYrlpKknICRHcmVlbgpTYXkgJyAg6K+m57uG6KeBIFJFQURNRS5tZCcgJEdyZWVuClNheSAnJwpS
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
