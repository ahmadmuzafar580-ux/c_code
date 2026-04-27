#include <stdio.h>
int main()
{
    int per;
    printf("Enter your percentage: ");
    scanf("%d", &per);
    if (per>=75){
        printf("A grade\   n");
        

    }
    else if (per>=60){
        printf("B grade\   n");
    }
    else if (per>=50){
        printf("C grade\   n");
    }
    else if (per>=40){
        printf("D grade\   n");
    }
    else{
        printf("Fail\   n");
    }       
}