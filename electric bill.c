#include <stdio.h>

int main()
{
    int units;
    float bill;

    printf("Enter the number of units consumed: ");
    scanf("%d", &units);

    if (units <= 200)
        bill = units * 2.4;
    else if (units <= 400)
        bill = units * 4.0;
    else if (units <= 600)
        bill = units * 4.35;
    else
        bill = units * 5.0;   // added extra slab

    printf("The total electricity bill is %.2f", bill);

    return 0;
}