#include<stdio.h>
int main ()
{
    int add ,sub ,mul ,div,exeponent,root ,log;
    printf("Enter the first number : ");
    scanf("%d",&add);               
    printf("Enter the second number : ");
    scanf("%d",&sub);
    mul = add * sub;
    div = add / sub;
    exeponent = add * add;
    root = add / 2;
    log = add / sub;
    printf("The addition of two numbers is : %d\n",add + sub);
    printf("The subtraction of two numbers is : %d\n",add - sub);
    printf("The multiplication of two numbers is : %d\n",mul);
    printf("The division of two numbers is : %d\n",div);
    printf("The exponent of first number is : %d\n",exeponent);
    printf("The root of first number is : %d\n",root);
    printf("The logarithm of first number is : %d\n",log);
    return 0;
    
}