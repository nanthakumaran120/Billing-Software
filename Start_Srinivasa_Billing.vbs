' Srinivasa Dyeing Billing Software — Silent Launcher
' Double-click this or use the Desktop shortcut to start the app.

Dim sBat, oShell, sCmd

sBat = "D:\New folder\billing\Start_Billing.bat"

Set oShell = CreateObject("WScript.Shell")

' Set PATH to include Node.js so npm is found even in minimal shell environments
oShell.Environment("PROCESS")("PATH") = _
    "C:\Program Files\nodejs;" & _
    "C:\Users\Nanth\AppData\Roaming\npm;" & _
    oShell.Environment("SYSTEM")("PATH")

' Run the BAT file hidden (WindowStyle 0 = no console flash)
sCmd = "cmd.exe /c """ & sBat & """"
oShell.Run sCmd, 0, False

Set oShell = Nothing
