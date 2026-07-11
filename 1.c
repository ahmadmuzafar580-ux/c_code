#include <stdio.h>

int main()
{
    int square;
    int area;
    int perimeter;

    printf("Enter the side of the square: ");
    scanf("%d", &square);

    area = square * square;
    perimeter = 4 * square;

    printf("Area of the square is %d\n", area);
    printf("Perimeter of the square is %d\n", perimeter);

    return 0;
}