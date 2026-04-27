G21 ; Set units to mm
G90 ; Absolute positioning
G28 ; Home all axes
G1 X0 Y0 Z0.2 F1500
G1 X20 Y0 F1500
G1 X20 Y20 F1500
G1 X0 Y20 F1500
G1 X0 Y0 F1500
M84 ; Disable motors
