
#include <stdio.h>

int main()
{
    int a, b, c;

    printf("Enter the sides of a triangle: ");
    scanf("%d %d %d", &a, &b, &c);

    // Check if valid triangle
    if (a + b > c && a + c > b && b + c > a)
    {
        printf("Valid triangle\n");

        // Check type of triangle
        if (a == b && b == c)
        {
            printf("The triangle is equilateral");
        }
        else if (a == b || a == c || b == c)
        {
            printf("The triangle is isosceles");
        }
        else
        {
            printf("The triangle is scalene");
        }
    }
    else
    {
        printf("Not a valid triangle");
    }

    return 0;
}