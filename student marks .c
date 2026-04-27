#include<stdio.h>

int main() {
    int s1, s2, s3, s4, s5;
    float per;

    printf("Enter marks of 5 subjects: ");
    scanf("%d%d%d%d%d", &s1, &s2, &s3, &s4, &s5);

    per = (s1 + s2 + s3 + s4 + s5) / 5.0;

    printf("Percentage: %.2f\n", per);

    if (per >= 75) {
        printf("A grade\n");
    }
    else if (per >= 60) {
        printf("B grade\n");
    }
    else if (per >= 50) {
        printf("C grade\n");
    }
    else if (per >= 40) {
        printf("D grade\n");
    }
    else {
        printf("Fail\n");
    }

    return 0;
}
