#include <stdio.h>

int main()
{
    int choice;
    float radius, length, breadth, height;
    float area, volume, circumference;

    printf("===== Mathematical Calculator =====\n");

    printf("1. Area of Circle\n");
    printf("2. Circumference of Circle\n");
    printf("3. Area of Triangle\n");
    printf("4. Area of Trapezium\n");
    printf("5. Volume of Cuboid\n");

    printf("Enter your choice: ");
    scanf("%d", &choice);


    switch(choice)
    {
        case 1:
            printf("Enter radius: ");
            scanf("%f", &radius);

            area = 3.14 * radius * radius;

            printf("Area of Circle = %.2f", area);
            break;


        case 2:
            printf("Enter radius: ");
            scanf("%f", &radius);

            circumference = 2 * 3.14 * radius;

            printf("Circumference = %.2f", circumference);
            break;


        case 3:
            printf("Enter base and height: ");
            scanf("%f %f", &breadth, &height);

            area = 0.5 * breadth * height;

            printf("Area of Triangle = %.2f", area);
            break;


        case 4:
            printf("Enter two parallel sides and height: ");
            scanf("%f %f %f", &length, &breadth, &height);

            area = ((length + breadth) * height) / 2;

            printf("Area of Trapezium = %.2f", area);
            break;


        case 5:
            printf("Enter length breadth height: ");
            scanf("%f %f %f", &length, &breadth, &height);

            volume = length * breadth * height;

            printf("Volume = %.2f", volume);
            break;


        default:
            printf("Invalid choice");
    }

    return 0;
}