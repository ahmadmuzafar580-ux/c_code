#include <stdio.h>

int main() {
    int signal;

    printf("Enter signal (1=Red, 2=Yellow, 3=Green): ");
    scanf("%d", &signal);

    if (signal == 1) {
        printf("Stop! The light is Red.\n");
    } 
    else if (signal == 2) {
        printf("Wait! The light is Yellow.\n");
    } 
    else if (signal == 3) {
        printf("Go! The light is Green.\n");
    } 
    else {
        printf("Invalid input!\n");
    }

    return 0;
}